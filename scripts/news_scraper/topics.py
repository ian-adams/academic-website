"""
Topic-specific configurations for news scrapers.
Each topic has its own classification prompt, keyword patterns, and story types.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class TopicConfig:
    """Configuration for a specific news topic."""
    name: str
    config_file: str
    db_name: str
    json_output: str
    rss_output: str
    llm_prompt: str
    keyword_patterns: dict[str, list[str]]  # For keyword pre-filtering
    story_types: list[str]


# =============================================================================
# AI POLICING TOPIC
# =============================================================================
AI_POLICING_PROMPT = """You are a strict classifier for an academic researcher studying AI technology deployed by US police departments.

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

AI_POLICING_KEYWORDS = {
    'law_enforcement': [
        'police', 'sheriff', 'law enforcement', 'officer', 'cop',
        'department', 'pd', 'deputy', 'federal agent', 'patrol'
    ],
    'ai_tech': [
        'ai', 'artificial intelligence', 'machine learning', 'algorithm',
        'automated', 'facial recognition', 'predictive', 'surveillance',
        'shotspotter', 'axon', 'body cam', 'bodycam', 'license plate reader',
        'alpr', 'clearview', 'flock', 'real-time crime', 'drone'
    ]
}

# =============================================================================
# K9 INCIDENTS TOPIC
# =============================================================================
K9_PROMPT = """You are a strict classifier for an academic researcher studying police K9 units, incidents, and legal issues.

Article Title: {title}
Article Summary: {snippet}
Source: {source}

ONLY answer YES if the article is SPECIFICALLY about:
- Police K9/canine bite incidents or injuries
- K9 attacks on suspects, bystanders, or wrong persons
- Lawsuits, settlements, or legal cases involving police dogs
- K9 officer deaths (heat, line of duty, accidents)
- Police dog training standards or certification issues
- K9 unit policy changes or reforms
- Drug detection dog reliability or false alerts
- Fourth Amendment challenges to K9 searches
- K9 program disbandment or policy changes
- Racial disparities in K9 deployments
- Successful K9 apprehensions (if notable)

Answer NO for:
- General police news without K9 involvement
- Pet dogs or non-police canines
- Military working dogs (unless domestic law enforcement)
- Airport/TSA detection dogs (unless police)
- Search and rescue dogs (unless police K9 unit)
- K9 adoption/retirement feel-good stories (unless policy-relevant)
- Police memorial events (unless substantive K9 content)
- Brief mentions of K9 in broader crime stories

Be STRICT. When in doubt, answer NO.

Reply with exactly one word: YES or NO"""

K9_KEYWORDS = {
    'k9_terms': [
        'k9', 'k-9', 'canine', 'police dog', 'drug dog', 'detection dog',
        'police canine', 'k9 unit', 'canine unit', 'handler'
    ],
    'incident_terms': [
        'bite', 'attack', 'injury', 'mauled', 'lawsuit', 'settlement',
        'death', 'died', 'killed', 'false alert', 'false positive',
        'excessive force', 'civil rights', 'fourth amendment', 'search'
    ]
}

# =============================================================================
# FORCE SCIENCE TOPIC
# =============================================================================
FORCE_SCIENCE_PROMPT = """You are a strict classifier for an academic researcher studying Force Science Institute (FSI) and its influence on police use-of-force cases.

Article Title: {title}
Article Summary: {snippet}
Source: {source}

ONLY answer YES if the article:
- Explicitly mentions "Force Science" or "Force Science Institute"
- Mentions Bill Lewinski or William Lewinski
- Discusses Daubert/Frye challenges to police use-of-force expert testimony
- Covers FSI-affiliated concepts being used in court (action beats reaction, inattentional blindness, slip and capture, auditory exclusion)
- Reports on cases where FSI experts testified
- Discusses challenges to police shooting expert witness credibility
- Covers police training programs using Force Science methodology
- Mentions FSI certification or Force Science Analyst

Answer NO for:
- General police shooting coverage without expert witness focus
- Use of force incidents without Force Science connection
- General police training news without FSI involvement
- Academic research on police that doesn't mention FSI
- Generic "junk science" discussions without police context
- Police reform news without expert witness angle
- Court cases without expert testimony discussion

Be VERY STRICT. Force Science is a specific organization - only include articles with clear FSI connection.

Reply with exactly one word: YES or NO"""

FORCE_SCIENCE_KEYWORDS = {
    'primary': [
        'force science', 'lewinski', 'force science institute',
        'force science analyst', 'fsi'
    ],
    'secondary': [
        'daubert', 'frye', 'expert witness', 'expert testimony',
        'use of force expert', 'police shooting expert',
        'action beats reaction', 'inattentional blindness',
        'slip and capture', 'auditory exclusion', 'perceptual distortion'
    ]
}

# =============================================================================
# TOPIC REGISTRY
# =============================================================================
TOPICS = {
    'ai-policing': TopicConfig(
        name='AI Policing',
        config_file='config/news-sources.yaml',
        db_name='news_archive.db',
        json_output='static/data/ai-police-news.json',
        rss_output='static/data/ai-police-news.xml',
        llm_prompt=AI_POLICING_PROMPT,
        keyword_patterns=AI_POLICING_KEYWORDS,
        story_types=['incident', 'policy', 'vendor', 'research', 'opinion', 'general']
    ),
    'k9': TopicConfig(
        name='K9 Incidents',
        config_file='config/k9-incident-sources.yaml',
        db_name='k9_archive.db',
        json_output='static/data/k9-incidents.json',
        rss_output='static/data/k9-incidents.xml',
        llm_prompt=K9_PROMPT,
        keyword_patterns=K9_KEYWORDS,
        story_types=['incident', 'legal', 'death', 'policy', 'training', 'capture', 'opinion', 'general']
    ),
    'force-science': TopicConfig(
        name='Force Science',
        config_file='config/force-science-sources.yaml',
        db_name='force_science_archive.db',
        json_output='static/data/force-science-news.json',
        rss_output='static/data/force-science-news.xml',
        llm_prompt=FORCE_SCIENCE_PROMPT,
        keyword_patterns=FORCE_SCIENCE_KEYWORDS,
        story_types=['legal', 'daubert', 'academic', 'policy', 'investigative', 'prosecutorial', 'opinion', 'general']
    )
}


def get_topic(topic_name: str) -> TopicConfig:
    """Get topic configuration by name."""
    if topic_name not in TOPICS:
        raise ValueError(f"Unknown topic: {topic_name}. Available: {list(TOPICS.keys())}")
    return TOPICS[topic_name]


def keyword_prefilter(title: str, snippet: str, topic: TopicConfig) -> bool:
    """
    Check if article passes keyword pre-filter for a topic.
    Returns True if article should be sent to LLM for classification.
    """
    text = f"{title} {snippet or ''}".lower()

    patterns = topic.keyword_patterns

    # For AI policing: need both law enforcement AND AI terms
    if topic.name == 'AI Policing':
        has_law = any(kw in text for kw in patterns.get('law_enforcement', []))
        has_ai = any(kw in text for kw in patterns.get('ai_tech', []))
        return has_law and has_ai

    # For K9: need K9 terms AND incident/legal terms
    elif topic.name == 'K9 Incidents':
        has_k9 = any(kw in text for kw in patterns.get('k9_terms', []))
        has_incident = any(kw in text for kw in patterns.get('incident_terms', []))
        return has_k9 and has_incident

    # For Force Science: primary terms OR (secondary terms in specific context)
    elif topic.name == 'Force Science':
        has_primary = any(kw in text for kw in patterns.get('primary', []))
        has_secondary = any(kw in text for kw in patterns.get('secondary', []))
        # Primary terms are strong signals
        if has_primary:
            return True
        # Secondary terms need additional police/court context
        if has_secondary:
            police_context = any(w in text for w in ['police', 'officer', 'shooting', 'court', 'testimony', 'trial'])
            return police_context
        return False

    # Default: check any pattern group
    for group in patterns.values():
        if any(kw in text for kw in group):
            return True
    return False
