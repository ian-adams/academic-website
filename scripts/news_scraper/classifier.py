"""
Article classifier using Claude API for relevance and keywords for story type.
Supports both binary YES/NO classification and multi-label JSON classification for Force Science.
"""

import os
import re
import json
import logging
import time
from typing import Optional
from dataclasses import dataclass

import anthropic

logger = logging.getLogger(__name__)


@dataclass
class ForceScienceClassification:
    """Result of Force Science multi-label classification."""
    label: str  # DIRECT, PROXY, ADJACENT, NO
    confidence: float  # 0.0 to 1.0
    relevance: int  # 0 to 100
    signals: list[str]  # Matched textual triggers
    entities: list[str]  # Extracted named entities
    rationale: str  # One-sentence explanation
    raw_response: Optional[str] = None  # For debugging
    parse_error: Optional[str] = None  # If parsing failed

    def is_relevant(self) -> bool:
        """Check if article should be stored (not NO)."""
        return self.label in ('DIRECT', 'PROXY', 'ADJACENT')

    def to_is_relevant_int(self) -> int:
        """Convert to legacy is_relevant integer."""
        return 1 if self.is_relevant() else 0

    def signals_json(self) -> str:
        """Return signals as JSON string for storage."""
        return json.dumps(self.signals)

    def entities_json(self) -> str:
        """Return entities as JSON string for storage."""
        return json.dumps(self.entities)

# Classification prompt for Claude API - strict focus on US police + AI
RELEVANCE_PROMPT = """You are a strict classifier for an academic researcher studying AI technology deployed by US police departments.

Article Title: {title}
Article Summary: {snippet}
Source: {source}

ONLY answer YES if the article is SPECIFICALLY about:
- US police/sheriff departments USING or ADOPTING AI technology
- AI tools for police report writing (Axon Draft One, Truleo)
- Police facial recognition deployments
- Police body camera AI/analytics
- Police use of ShotSpotter/gunshot detection
- Police predictive policing software
- Police license plate readers (ALPR, Flock Safety)
- Police drones with AI capabilities
- Real-time crime centers with AI
- Police department AI policy/oversight/regulation
- Incidents or errors involving police AI systems

Answer NO for:
- General AI/tech news that merely mentions police in passing
- Axon/vendor stock prices or earnings (unless about specific police contracts)
- Crime news that doesn't discuss AI technology
- Non-US law enforcement (UK, EU, etc.)
- Military or intelligence agency AI (FBI, CIA, NSA)
- Cybersecurity or hacking stories
- AI ethics discussions without specific police focus
- Surveillance technology not used by police
- General "future of policing" opinion pieces without concrete AI focus

Be STRICT. When in doubt, answer NO.

Reply with exactly one word: YES or NO"""


class ArticleClassifier:
    """Classify articles for relevance and story type."""

    # Story type keywords
    STORY_TYPE_PATTERNS = {
        'incident': [
            r'\berror\b', r'\bmistake\b', r'\bhallucin', r'\bwrong\b',
            r'\bfail', r'\bsue\b', r'\blawsuit\b', r'\bsettle',
            r'\baccident\b', r'\binjur', r'\bkill', r'\bdeath\b',
            r'\bvictim\b', r'\bshoot', r'\bbite\b', r'\battack',
            r'\bwrongful\b', r'\bfalse\b', r'\bmisidentif'
        ],
        'policy': [
            r'\bpolicy\b', r'\bpolicies\b', r'\bregulat', r'\blegislat',
            r'\bban\b', r'\bbanned\b', r'\bmoratorium\b', r'\bordinance\b',
            r'\blaw\b', r'\blaws\b', r'\bbill\b', r'\bact\b',
            r'\bcommittee\b', r'\bhearing\b', r'\boversight\b',
            r'\btransparency\b', r'\baccountab', r'\baudit\b',
            r'\bguidelines\b', r'\bstandards\b', r'\brequirements\b'
        ],
        'vendor': [
            r'\baxon\b', r'\btruleo\b', r'\bveritone\b', r'\bmotorola\b',
            r'\bshotspotter\b', r'\bsoundthinking\b', r'\bflock\b',
            r'\bclearview\b', r'\bcellebrite\b', r'\bpalantir\b',
            r'\bcontract\b', r'\bpartner', r'\bdeploy', r'\blaunch',
            r'\brelease\b', r'\bupdate\b', r'\bversion\b',
            r'\brevenue\b', r'\bearnings\b', r'\bquarter', r'\bstock\b',
            r'\binvestor\b', r'\bipo\b', r'\bacquisition\b'
        ],
        'research': [
            r'\bstudy\b', r'\bstudies\b', r'\bresearch', r'\breport\b',
            r'\banalysis\b', r'\bfindings\b', r'\bdata\b',
            r'\buniversity\b', r'\bprofessor\b', r'\bacademic\b',
            r'\bjournal\b', r'\bpublish', r'\bpeer.?review',
            r'\bsurvey\b', r'\bstatistic'
        ],
        'opinion': [
            r'\bopinion\b', r'\beditorial\b', r'\bop.?ed\b',
            r'\bcommentary\b', r'\bcolumn', r'\bperspective\b',
            r'\bshould\b', r'\bmust\b', r'\bneed to\b',
            r'\bwhy we\b', r'\bwhy i\b', r'\bwhat we\b'
        ]
    }

    def __init__(self, api_key: Optional[str] = None, custom_prompt: Optional[str] = None):
        """
        Initialize classifier.

        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            custom_prompt: Custom relevance classification prompt (uses default if None)
        """
        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
        self.client = None
        self.custom_prompt = custom_prompt

        if self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
        else:
            logger.warning("No Anthropic API key provided. LLM classification disabled.")

    def classify_relevance(
        self,
        title: str,
        snippet: Optional[str],
        source: str
    ) -> tuple[bool, Optional[str]]:
        """
        Classify if an article is relevant using Claude API.

        Returns:
            Tuple of (is_relevant: bool, model_used: str or None)
        """
        if not self.client:
            # Fallback to keyword matching if no API key
            return self._keyword_relevance(title, snippet), None

        # Use custom prompt if provided, otherwise use default
        prompt_template = self.custom_prompt or RELEVANCE_PROMPT
        prompt = prompt_template.format(
            title=title,
            snippet=snippet or "(no summary available)",
            source=source
        )

        try:
            response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            answer = response.content[0].text.strip().upper()
            is_relevant = answer.startswith('YES')

            logger.debug(f"Claude classified '{title[:50]}...' as {'relevant' if is_relevant else 'not relevant'}")
            return is_relevant, "claude-3-haiku-20240307"

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            # Fallback to keyword matching
            return self._keyword_relevance(title, snippet), None

    def _keyword_relevance(self, title: str, snippet: Optional[str]) -> bool:
        """Fallback keyword-based relevance check."""
        text = f"{title} {snippet or ''}".lower()

        # Must mention law enforcement
        law_enforcement = any(kw in text for kw in [
            'police', 'sheriff', 'law enforcement', 'officer',
            'department', 'pd', 'deputy', 'cop', 'federal agent'
        ])

        # Must mention AI/tech
        ai_tech = any(kw in text for kw in [
            'ai', 'artificial intelligence', 'machine learning',
            'algorithm', 'automated', 'facial recognition',
            'predictive', 'surveillance', 'shotspotter',
            'axon', 'body cam', 'bodycam', 'license plate reader',
            'alpr', 'clearview', 'flock'
        ])

        return law_enforcement and ai_tech

    def classify_force_science(
        self,
        title: str,
        snippet: Optional[str],
        source: str,
        prompt_template: str
    ) -> ForceScienceClassification:
        """
        Classify article for Force Science using multi-label JSON output.

        Args:
            title: Article title
            snippet: Article snippet/summary
            source: Article source
            prompt_template: The Force Science LLM prompt template

        Returns:
            ForceScienceClassification with label, confidence, relevance, etc.
        """
        if not self.client:
            # Fallback to NO if no API key
            return ForceScienceClassification(
                label='NO',
                confidence=0.0,
                relevance=0,
                signals=[],
                entities=[],
                rationale='No API key available for classification',
                parse_error='no_api_key'
            )

        prompt = prompt_template.format(
            title=title,
            snippet=snippet or "(no summary available)",
            source=source
        )

        try:
            response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=500,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            raw_response = response.content[0].text.strip()
            return self._parse_force_science_response(raw_response)

        except Exception as e:
            logger.error(f"Claude API error for Force Science classification: {e}")
            return ForceScienceClassification(
                label='NO',
                confidence=0.0,
                relevance=0,
                signals=[],
                entities=[],
                rationale=f'API error: {str(e)}',
                parse_error=str(e)
            )

    def _parse_force_science_response(self, raw_response: str) -> ForceScienceClassification:
        """
        Parse and validate Force Science JSON response.

        Validates:
        - JSON parse success
        - label in allowed set
        - confidence numeric 0-1
        - relevance integer 0-100

        Falls back to NO with logged error on parse failure.
        """
        try:
            # Try to extract JSON from response (handle potential markdown wrapping)
            json_str = raw_response
            if '```json' in raw_response:
                json_str = raw_response.split('```json')[1].split('```')[0].strip()
            elif '```' in raw_response:
                json_str = raw_response.split('```')[1].split('```')[0].strip()

            data = json.loads(json_str)

            # Validate required fields
            label = str(data.get('label', 'NO')).upper()
            if label not in ('DIRECT', 'PROXY', 'ADJACENT', 'NO'):
                logger.warning(f"Invalid label '{label}', defaulting to NO")
                label = 'NO'

            # Validate confidence
            confidence = float(data.get('confidence', 0.0))
            if not 0.0 <= confidence <= 1.0:
                logger.warning(f"Invalid confidence {confidence}, clamping to [0,1]")
                confidence = max(0.0, min(1.0, confidence))

            # Validate relevance
            relevance = int(data.get('relevance', 0))
            if not 0 <= relevance <= 100:
                logger.warning(f"Invalid relevance {relevance}, clamping to [0,100]")
                relevance = max(0, min(100, relevance))

            # Extract signals (list of strings)
            signals = data.get('signals', [])
            if isinstance(signals, str):
                signals = [signals]
            signals = [str(s) for s in signals if s]

            # Extract entities (list of strings)
            entities = data.get('entities', [])
            if isinstance(entities, str):
                entities = [entities]
            entities = [str(e) for e in entities if e]

            # Extract rationale
            rationale = str(data.get('rationale', ''))

            return ForceScienceClassification(
                label=label,
                confidence=confidence,
                relevance=relevance,
                signals=signals,
                entities=entities,
                rationale=rationale,
                raw_response=raw_response
            )

        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            logger.error(f"Failed to parse Force Science response: {e}")
            logger.debug(f"Raw response: {raw_response}")
            return ForceScienceClassification(
                label='NO',
                confidence=0.0,
                relevance=0,
                signals=[],
                entities=[],
                rationale='Parse error - treating as not relevant',
                raw_response=raw_response,
                parse_error=str(e)
            )

    def classify_story_type(
        self,
        title: str,
        snippet: Optional[str]
    ) -> str:
        """
        Classify story type using keyword patterns.

        Returns one of: incident, policy, vendor, research, opinion, general
        """
        text = f"{title} {snippet or ''}".lower()

        scores = {}
        for story_type, patterns in self.STORY_TYPE_PATTERNS.items():
            score = sum(1 for p in patterns if re.search(p, text, re.IGNORECASE))
            scores[story_type] = score

        # Return type with highest score, or 'general' if no matches
        if max(scores.values()) > 0:
            return max(scores, key=scores.get)
        return 'general'

    def extract_entities(self, title: str, snippet: Optional[str]) -> str:
        """Extract key entities (organizations, products) from text."""
        text = f"{title} {snippet or ''}"

        entities = []

        # Known entities to look for
        known_entities = [
            'Axon', 'Truleo', 'Veritone', 'Motorola', 'ShotSpotter',
            'SoundThinking', 'Flock Safety', 'Clearview AI', 'Palantir',
            'Cellebrite', 'Ring', 'Amazon', 'Google', 'Microsoft',
            'ACLU', 'EFF', 'DOJ', 'FBI', 'ICE', 'CBP', 'DHS',
            'NYPD', 'LAPD', 'Chicago PD'
        ]

        for entity in known_entities:
            if entity.lower() in text.lower():
                entities.append(entity)

        return ', '.join(entities) if entities else ''

    def extract_tags(self, title: str, snippet: Optional[str]) -> list[str]:
        """Extract relevant tags from article text."""
        text = f"{title} {snippet or ''}".lower()

        tags = []

        # Tag patterns
        tag_keywords = {
            'AI': ['ai', 'artificial intelligence', 'machine learning'],
            'facial recognition': ['facial recognition', 'face recognition', 'clearview'],
            'predictive policing': ['predictive policing', 'predpol', 'crime prediction'],
            'surveillance': ['surveillance', 'monitoring', 'tracking'],
            'body camera': ['body cam', 'bodycam', 'body-worn', 'bwc'],
            'ALPR': ['license plate', 'alpr', 'lpr', 'flock'],
            'gunshot detection': ['shotspotter', 'soundthinking', 'gunshot'],
            'police report': ['police report', 'report writing', 'draft one'],
            'civil rights': ['civil rights', 'civil liberties', 'privacy', 'bias'],
            'Axon': ['axon'],
            'error': ['error', 'mistake', 'hallucination', 'wrong'],
            'policy': ['policy', 'regulation', 'ban', 'oversight'],
        }

        for tag, keywords in tag_keywords.items():
            if any(kw in text for kw in keywords):
                tags.append(tag)

        return tags


def classify_batch(
    classifier: ArticleClassifier,
    articles: list[dict],
    delay: float = 0.5
) -> list[tuple[str, bool, Optional[str], str]]:
    """
    Classify a batch of articles with rate limiting.

    Args:
        classifier: ArticleClassifier instance
        articles: List of article dicts with url_hash, title, snippet, source
        delay: Seconds to wait between API calls (default 0.5s = 120 req/min)

    Returns:
        List of tuples: (url_hash, is_relevant, model, story_type)
    """
    results = []
    total = len(articles)

    for i, article in enumerate(articles):
        is_relevant, model = classifier.classify_relevance(
            article['title'],
            article.get('snippet'),
            article.get('source', '')
        )

        story_type = classifier.classify_story_type(
            article['title'],
            article.get('snippet')
        )

        results.append((
            article['url_hash'],
            is_relevant,
            model,
            story_type
        ))

        # Rate limiting - add delay between API calls
        if model and i < total - 1:  # Only delay if we made an API call and not last item
            time.sleep(delay)

        # Progress logging every 10 articles
        if (i + 1) % 10 == 0:
            logger.info(f"Classified {i + 1}/{total} articles")

    return results
