/**
 * Shared types for news scrapers
 * These match the interfaces expected by the frontend NewsFeedClient
 */

export interface NewsStory {
  id: string;
  url: string;
  title: string;
  source: string;
  date: string;
  date_discovered: string;
  summary: string;
  story_type?: 'research' | 'incident' | 'general' | 'investigative';
  relevance_score?: number;
  key_entities?: string;
  location?: string | null;
  tags?: string[];
  needs_review?: number;
}

export interface NewsFeed {
  updated: string;
  count: number;
  stories: NewsStory[];
}

export interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

export interface ClaudeAnalysis {
  story_type: 'research' | 'incident' | 'general' | 'investigative';
  relevance_score: number;
  key_entities: string;
  location: string | null;
  tags: string[];
  needs_review: number;
}

export interface ScraperConfig {
  topic: string;
  name: string;
  queries: string[];
  outputFile: string;
  dbFile: string;
  systemPrompt: string;
}

export const TOPICS: Record<string, ScraperConfig> = {
  'ai-police': {
    topic: 'ai-police',
    name: 'AI Police News',
    queries: [
      '"police department" AND "artificial intelligence"',
      '"law enforcement" AND "machine learning"',
      '"predictive policing" algorithm',
      '"facial recognition" AND ("police" OR "law enforcement")',
      '"police" AND "surveillance technology" -china -military',
      '"automated license plate reader" OR "ALPR" AND police',
      '"police body camera" AND "AI" OR "analytics"',
      '"gunshot detection" AND police',
    ],
    outputFile: 'ai-police-news.json',
    dbFile: 'ai-police-news.db',
    systemPrompt: `You are an expert analyst for a criminology professor's curated news feed on AI and technology in policing.

STRICT RELEVANCE CRITERIA - The article MUST be about:
- U.S. police departments deploying or evaluating AI/technology
- Research studies on AI use in law enforcement
- Policy debates about police surveillance technology
- Legal cases involving police use of AI/facial recognition
- Body camera analytics, predictive policing, or gunshot detection by police

REJECT (score 0.0-0.2) articles about:
- General AI/tech news not specifically about police
- Military or national security surveillance (unless about local police)
- International police (unless directly relevant to U.S. policing debates)
- Consumer technology or business AI applications
- Cybersecurity, fraud, or scams (unless police AI response)
- Market research reports or press releases about products

Provide analysis as JSON:
1. story_type: "research" (academic/peer-reviewed), "incident" (specific deployment/event), "investigative" (journalism deep-dive), or "general" (news coverage)
2. relevance_score: 0.0-1.0 - BE STRICT. Only score 0.6+ if clearly about police AI/technology
3. key_entities: comma-separated organizations, technologies, researchers mentioned
4. location: U.S. city/state if mentioned, or null
5. tags: 1-5 from: AI, facial recognition, predictive policing, surveillance, ALPR, body cameras, drones, robots, civil rights, privacy, policy, research
6. needs_review: 1 ONLY if genuinely unclear, 0 otherwise. When in doubt, score low rather than flagging for review.`,
  },
  'force-science': {
    topic: 'force-science',
    name: 'Force Science News',
    queries: [
      '"police" AND "use of force" AND ("research" OR "study" OR "policy")',
      '"officer-involved shooting" OR "officer involved shooting"',
      '"police shooting" AND ("investigation" OR "policy" OR "training")',
      '"force science" OR "use-of-force research"',
      '"police" AND "de-escalation" AND ("training" OR "policy")',
      '"taser" OR "conducted energy weapon" AND "police" AND ("policy" OR "death" OR "study")',
      '"police restraint" AND ("death" OR "asphyxia" OR "policy")',
      '"qualified immunity" AND "police" AND "excessive force"',
    ],
    outputFile: 'force-science-news.json',
    dbFile: 'force-science-news.db',
    systemPrompt: `You are an expert analyst for a criminology professor's curated news feed on police use of force and force science.

STRICT RELEVANCE CRITERIA - The article MUST be about:
- Academic research on police use of force
- Police officer-involved shootings in the U.S.
- Use of force policies, training, or reforms
- De-escalation training and tactics research
- Legal cases (Section 1983, qualified immunity) involving excessive force
- Taser/CEW incidents, restraint deaths, or related policy
- Force Science Institute or similar research organizations

REJECT (score 0.0-0.2) articles about:
- General violence, crime, or shootings NOT involving police use of force
- International conflicts, military force, or geopolitics
- Sports ("forcing" plays), business ("market forces"), politics ("forcing votes")
- Immigration enforcement (ICE/CBP) unless about use-of-force policy
- Prison/corrections (unless about police)
- Personal disputes, domestic violence, or non-police violence

Provide analysis as JSON:
1. story_type: "research" (academic/peer-reviewed), "incident" (specific use-of-force event), "investigative" (journalism deep-dive), or "general" (news coverage)
2. relevance_score: 0.0-1.0 - BE STRICT. Only score 0.6+ if clearly about police use of force
3. key_entities: comma-separated organizations, researchers, agencies mentioned
4. location: U.S. city/state if mentioned, or null
5. tags: 1-5 from: use of force, deadly force, training, policy, research, shooting, taser, restraint, de-escalation, body cameras, accountability, qualified immunity, Section 1983
6. needs_review: 1 ONLY if genuinely unclear, 0 otherwise. When in doubt, score low rather than flagging for review.`,
  },
  'k9': {
    topic: 'k9',
    name: 'Police K9 Incidents',
    queries: [
      '"police K9" OR "police K-9" AND (bite OR attack OR incident)',
      '"police dog" AND (bite OR attack OR lawsuit)',
      '"K9 unit" AND ("deployment" OR "policy" OR "injury")',
      '"police canine" AND ("bite" OR "force" OR "lawsuit")',
      '"sheriff" AND "K9" AND (bite OR attack)',
      '"police dog" AND "civil rights" OR "excessive force"',
    ],
    outputFile: 'k9-incidents.json',
    dbFile: 'k9-incidents.db',
    systemPrompt: `You are an expert analyst for a criminology professor's curated news feed on police K9 units and incidents.

STRICT RELEVANCE CRITERIA - The article MUST be about:
- Police K9 (canine unit) bites, attacks, or deployments
- Lawsuits or civil rights cases involving police dogs
- Police K9 training, policy, or certification issues
- Research on police K9 use and injuries
- Deaths or serious injuries from police dog bites

REJECT (score 0.0-0.2) articles about:
- Pet dogs, stray dogs, or non-police canines (even if aggressive)
- Military working dogs (unless loaned to police)
- K9 officers retiring, feel-good adoption stories, or ceremonies
- Drug-sniffing dogs at airports/borders (CBP/TSA, not local police)
- Police dogs finding missing persons (unless force was used)
- Any article where "K9" or "dog" appears incidentally or metaphorically
- Entertainment (movies, TV, books) mentioning police dogs
- Dingoes, coyotes, wolves, or wild animal attacks

Provide analysis as JSON:
1. story_type: "research" (academic/peer-reviewed), "incident" (specific K9 bite/deployment), "investigative" (journalism deep-dive), or "general" (news coverage)
2. relevance_score: 0.0-1.0 - BE STRICT. Only score 0.6+ if clearly about police K9 use-of-force or policy
3. key_entities: comma-separated agencies, departments, individuals mentioned
4. location: U.S. city/state if mentioned, or null
5. tags: 1-5 from: K9 bite, K9 deployment, training, policy, lawsuit, injury, search, narcotics, tracking, handler, civil rights, excessive force
6. needs_review: 1 ONLY if genuinely unclear, 0 otherwise. When in doubt, score low rather than flagging for review.`,
  },
  'media-mentions': {
    topic: 'media-mentions',
    name: 'Media Mentions',
    queries: [
      '"Ian Adams" police',
      '"Ian Adams" criminology',
      '"Ian Adams" "University of South Carolina"',
      '"Ian T. Adams"',
    ],
    outputFile: 'media-mentions.json',
    dbFile: 'media-mentions.db',
    systemPrompt: `You are an expert analyst identifying media mentions of Dr. Ian Adams, a criminology professor. Analyze the article and provide:
1. story_type: "research" (academic work cited), "incident" (commenting on events), "investigative" (in-depth feature), or "general" (brief mention)
2. relevance_score: 0.0-1.0 indicating confidence this actually mentions Dr. Ian Adams the criminologist (not another Ian Adams)
3. key_entities: comma-separated list of key topics, organizations, or co-authors mentioned
4. location: city/state/country if relevant, or null
5. tags: array of 1-5 relevant tags from: quote, research cited, interview, op-ed, expert commentary, policing, criminal justice, body cameras, use of force
6. needs_review: 1 if uncertain whether this is the correct Ian Adams, 0 if confident`,
  },
};
