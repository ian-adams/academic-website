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

# New JSON-based prompt for multi-label classification
FORCE_SCIENCE_PROMPT = """You are a strict classifier for a researcher studying Force Science as an organization and the broader police use-of-force expert testimony ecosystem.
Classify the article into exactly one label:

DIRECT: Explicit mention of "Force Science" or "Force Science Institute", or Bill/William Lewinski, or clearly identified Force Science staff/instructor (if named), or an unambiguous reference to Force Science as an organization.
PROXY: No explicit Force Science/Institute mention, but unambiguous organizational proxies appear (examples: "Force Science Analyst", "Force Science Certification Course", "Advanced Force Science Specialist Course", "Force Encounters Course", "Force Science News").
ADJACENT: No Force Science direct/proxy signals, but the article is substantially about police use-of-force litigation AND expert testimony gatekeeping/credibility (examples: Rule 702, Daubert/Frye, motions to exclude experts, admissibility, reliability/methodology disputes, qualification as an expert).
NO: None of the above.

Article Title: {title}
Article Summary: {snippet}
Source: {source}

Instructions:
- Output JSON only with keys: label, confidence, relevance, signals, entities, rationale.
- confidence is 0.0 to 1.0.
- relevance is 0 to 100. Use:
  - DIRECT: usually 90-100
  - PROXY: usually 70-89
  - ADJACENT: usually 40-69
  - NO: usually 0-39
- signals must list the exact phrases or features that triggered your decision (examples: "Force Science Analyst", "Rule 702", "motion to exclude", "Daubert", "use of force").
- entities should include named experts, organizations, courts, jurisdictions, and case names if present.
- rationale is exactly one sentence.

Return exactly one JSON object and nothing else."""

# Comprehensive keyword structure for Stage 1 pre-filtering
FORCE_SCIENCE_KEYWORDS = {
    # DIRECT/PROXY anchors - call LLM immediately if any match
    'direct_anchors': [
        'force science',
        'force science institute',
        'bill lewinski',
        'william lewinski',
        'lewinski'
    ],
    'proxy_anchors': [
        'force science analyst',
        'force science certification',
        'force science certification course',
        'advanced force science specialist',
        'advanced force science specialist course',
        'force encounters course',
        'force science news'
    ],

    # Force Science staff/instructors (DIRECT triggers, but need co-occurrence)
    'names_direct': [
        'brian baxter',
        'von kliem',
        'lewis von kliem',
        'lewis kliem',
        'michael musengo',
        'craig allen',
        'derrick crews',
        'nicole florisi'
    ],

    # Key critics/interlocutors (ADJACENT/critique signals)
    'names_critic': [
        'lisa fournier',
        'ian t. adams',
        'ian adams',
        'seth stoughton',
        'seth w. stoughton',
        'brandon del pozo',
        'geoffrey alpert',
        'geoffrey p. alpert'
    ],

    # Expert-testimony mechanics (for ADJACENT gatekeeping detection)
    # Includes basic terms that appear in article titles about expert testimony
    'expert_mechanics': [
        'rule 702',
        'daubert',
        'frye',
        'motion to exclude',
        'exclude expert',
        'expert excluded',
        'admissibility',
        'gatekeeping',
        'reliability',
        'methodology',
        'qualified as an expert',
        'expert report',
        'retained expert',
        'expert deposition',
        'affidavit',
        'expert witness',
        'expert testimony',
        'expert',
        'testify',
        'testified',
        'testifies',
        'forensic',
        'scientific',
        'credibility',
        'witness'
    ],

    # Police use-of-force context
    'police_force_context': [
        'police',
        'officer',
        'cop',
        'deputy',
        'sheriff',
        'law enforcement',
        'use of force',
        'excessive force',
        'officer-involved shooting',
        'officer involved shooting',
        'police shooting',
        'section 1983',
        '§ 1983',
        '1983',
        'civil rights',
        'wrongful death',
        'qualified immunity',
        'deadly force',
        'lethal force',
        'shooting',
        'taser',
        'chokehold'
    ],

    # Court context
    'court_context': [
        'trial',
        'testimony',
        'deposition',
        'hearing',
        'judge',
        'jury',
        'summary judgment',
        'appeal',
        'court',
        'lawsuit',
        'litigation',
        'motion',
        'case',
        'verdict',
        'ruling',
        'settlement',
        'plaintiff',
        'defendant'
    ],

    # FSI-affiliated concepts (secondary signals, need context)
    'fsi_concepts': [
        'action beats reaction',
        'inattentional blindness',
        'slip and capture',
        'auditory exclusion',
        'perceptual distortion',
        'action-perception',
        'reaction time'
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

    # For Force Science: comprehensive Stage 1 decision rules
    elif topic.name == 'Force Science':
        result = force_science_keyword_prefilter(text, patterns)
        return result['should_call_llm']

    # Default: check any pattern group
    for group in patterns.values():
        if any(kw in text for kw in group):
            return True
    return False


def force_science_keyword_prefilter(text: str, patterns: dict) -> dict:
    """
    Stage 1 keyword pre-filter for Force Science topic.

    Decision rules:
    1. Call LLM immediately if any DIRECT/PROXY anchor hits
    2. Call LLM if ADJACENT bundle holds:
       - expert-mechanics hits >= 2 AND
       - police-force context hits >= 1 AND
       - court context hits >= 1
    3. Handle "fsi" safely (only count if near Force Science context)
    4. Handle names with co-occurrence requirements

    Returns dict with diagnostics for logging.
    """
    result = {
        'should_call_llm': False,
        'direct_anchors_hit': [],
        'proxy_anchors_hit': [],
        'names_direct_hit': [],
        'names_critic_hit': [],
        'expert_mechanics_count': 0,
        'expert_mechanics_hit': [],
        'police_force_count': 0,
        'police_force_hit': [],
        'court_context_count': 0,
        'court_context_hit': [],
        'fsi_status': 'not_found',  # 'not_found', 'accepted', 'ignored'
        'trigger_reason': None
    }

    # Check DIRECT anchors (excluding "fsi" for special handling)
    for anchor in patterns.get('direct_anchors', []):
        if anchor in text:
            result['direct_anchors_hit'].append(anchor)

    # Check PROXY anchors
    for anchor in patterns.get('proxy_anchors', []):
        if anchor in text:
            result['proxy_anchors_hit'].append(anchor)

    # If any DIRECT or PROXY anchor hits, call LLM immediately
    if result['direct_anchors_hit'] or result['proxy_anchors_hit']:
        result['should_call_llm'] = True
        result['trigger_reason'] = 'direct_or_proxy_anchor'
        return result

    # Handle "fsi" acronym safely - only count if near Force Science context
    if 'fsi' in text:
        fsi_accepted = _check_fsi_proximity(text)
        if fsi_accepted:
            result['fsi_status'] = 'accepted'
            result['should_call_llm'] = True
            result['trigger_reason'] = 'fsi_with_context'
            return result
        else:
            result['fsi_status'] = 'ignored'

    # Count expert-testimony mechanics
    for term in patterns.get('expert_mechanics', []):
        if term in text:
            result['expert_mechanics_count'] += 1
            result['expert_mechanics_hit'].append(term)

    # Count police use-of-force context
    for term in patterns.get('police_force_context', []):
        if term in text:
            result['police_force_count'] += 1
            result['police_force_hit'].append(term)

    # Count court context
    for term in patterns.get('court_context', []):
        if term in text:
            result['court_context_count'] += 1
            result['court_context_hit'].append(term)

    # Check FSI-affiliated concepts with context
    fsi_concept_hits = [c for c in patterns.get('fsi_concepts', []) if c in text]
    if fsi_concept_hits:
        # FSI concepts need police/court context
        if result['police_force_count'] >= 1 or result['court_context_count'] >= 1:
            result['should_call_llm'] = True
            result['trigger_reason'] = 'fsi_concepts_with_context'
            return result

    # Check DIRECT names with co-occurrence requirement
    for name in patterns.get('names_direct', []):
        if name in text:
            result['names_direct_hit'].append(name)

    # DIRECT names need co-occurrence with Force Science anchors/proxies OR police/court/expert context
    if result['names_direct_hit']:
        has_fs_context = any(a in text for a in patterns.get('direct_anchors', []) + patterns.get('proxy_anchors', []))
        has_legal_context = (result['expert_mechanics_count'] >= 1 or
                            result['police_force_count'] >= 1 or
                            result['court_context_count'] >= 1)
        if has_fs_context or has_legal_context:
            result['should_call_llm'] = True
            result['trigger_reason'] = 'direct_name_with_context'
            return result

    # Check CRITIC names with co-occurrence requirement
    for name in patterns.get('names_critic', []):
        if name in text:
            result['names_critic_hit'].append(name)

    # CRITIC names need co-occurrence with Force Science OR (expert-mechanics + police-force)
    if result['names_critic_hit']:
        has_fs_context = any(a in text for a in patterns.get('direct_anchors', []) + patterns.get('proxy_anchors', []))
        has_adjacent_bundle = (result['expert_mechanics_count'] >= 1 and result['police_force_count'] >= 1)
        if has_fs_context or has_adjacent_bundle:
            result['should_call_llm'] = True
            result['trigger_reason'] = 'critic_name_with_context'
            return result

    # ADJACENT bundle check (very permissive to let LLM do fine-grained filtering):
    # The search queries already pre-filter articles, so Stage 1 should be inclusive.
    # Option 1: expert-mechanics >= 1 AND police-force >= 1 (core combination)
    # Option 2: expert-mechanics >= 1 AND court >= 1 (legal context with expert)
    # Option 3: expert-mechanics >= 2 (strong expert testimony signal)
    # Option 4: police-force >= 1 AND court >= 2 (strong legal context about police)
    # Option 5: police-force >= 2 AND court >= 1 (strong police context in legal setting)
    # Option 6: expert-mechanics >= 1 (any expert testimony term - let LLM decide)
    has_adjacent = (
        (result['expert_mechanics_count'] >= 1 and result['police_force_count'] >= 1) or
        (result['expert_mechanics_count'] >= 1 and result['court_context_count'] >= 1) or
        (result['expert_mechanics_count'] >= 2) or
        (result['police_force_count'] >= 1 and result['court_context_count'] >= 2) or
        (result['police_force_count'] >= 2 and result['court_context_count'] >= 1) or
        (result['expert_mechanics_count'] >= 1)  # Any expert term - permissive fallback
    )
    if has_adjacent:
        result['should_call_llm'] = True
        result['trigger_reason'] = 'adjacent_bundle'
        return result

    # Final fallback: Any police + court context combination
    # This catches articles about police litigation that don't use "expert" language
    # The LLM will filter out truly irrelevant ones
    if result['police_force_count'] >= 1 and result['court_context_count'] >= 1:
        result['should_call_llm'] = True
        result['trigger_reason'] = 'police_court_context'
        return result

    return result


def _check_fsi_proximity(text: str, window: int = 8) -> bool:
    """
    Check if "fsi" appears near Force Science context.
    Only count "fsi" if it appears within ±window tokens of context terms.
    """
    import re

    # Context terms that validate "fsi"
    context_terms = [
        'force science', 'analyst', 'certification', 'lewinski',
        'use of force', 'expert', 'testimony', 'police', 'officer'
    ]

    # Tokenize text
    tokens = re.findall(r'\b\w+\b', text.lower())

    # Find all positions of "fsi"
    fsi_positions = [i for i, t in enumerate(tokens) if t == 'fsi']

    if not fsi_positions:
        return False

    # For each "fsi" occurrence, check if any context term is within window
    for pos in fsi_positions:
        start = max(0, pos - window)
        end = min(len(tokens), pos + window + 1)
        window_text = ' '.join(tokens[start:end])

        for term in context_terms:
            if term in window_text:
                return True

    return False


def force_science_prefilter_with_diagnostics(title: str, snippet: str, topic: TopicConfig) -> dict:
    """
    Full Stage 1 pre-filter for Force Science with diagnostics for logging.
    Returns detailed diagnostics dict.
    """
    text = f"{title} {snippet or ''}".lower()
    return force_science_keyword_prefilter(text, topic.keyword_patterns)
