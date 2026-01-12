"""
Article classifier using Claude API for relevance and keywords for story type.
"""

import os
import re
import logging
from typing import Optional

import anthropic

logger = logging.getLogger(__name__)

# Classification prompt for Claude API
RELEVANCE_PROMPT = """You are classifying news articles for an academic researcher studying AI and automated technology in US law enforcement.

Article Title: {title}
Article Summary: {snippet}
Source: {source}

Is this article primarily about artificial intelligence, machine learning, or automated technology being used by US law enforcement agencies (police, sheriff, federal agencies)?

Relevant topics include:
- AI report writing tools (Axon Draft One, Truleo)
- Predictive policing software
- Facial recognition by police
- Automated license plate readers (ALPR)
- Gunshot detection (ShotSpotter, SoundThinking)
- Body camera AI analytics
- Police use of ChatGPT or LLMs
- AI surveillance by law enforcement
- Police drones with AI
- Real-time crime centers

NOT relevant:
- General AI news without law enforcement connection
- Crime stories that don't discuss technology
- AI in non-US law enforcement only
- General cybersecurity without police context
- Military AI (unless domestic law enforcement)

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

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize classifier.

        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
        """
        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
        self.client = None

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

        prompt = RELEVANCE_PROMPT.format(
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
    articles: list[dict]
) -> list[tuple[str, bool, Optional[str], str]]:
    """
    Classify a batch of articles.

    Args:
        classifier: ArticleClassifier instance
        articles: List of article dicts with url_hash, title, snippet, source

    Returns:
        List of tuples: (url_hash, is_relevant, model, story_type)
    """
    results = []

    for article in articles:
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

    return results
