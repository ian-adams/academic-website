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
      'police artificial intelligence',
      'law enforcement AI technology',
      'predictive policing algorithm',
      'facial recognition police',
      'police surveillance technology',
      'automated license plate reader police',
    ],
    outputFile: 'ai-police-news.json',
    dbFile: 'ai-police-news.db',
    systemPrompt: `You are an expert analyst categorizing news articles about artificial intelligence and technology use in policing. Analyze the article and provide:
1. story_type: "research" (academic/studies), "incident" (specific events), "investigative" (in-depth reporting), or "general" (news coverage)
2. relevance_score: 0.0-1.0 indicating how relevant this is to AI/technology in policing
3. key_entities: comma-separated list of key organizations, technologies, or people mentioned
4. location: city/state/country if mentioned, or null
5. tags: array of 1-5 relevant tags from: AI, facial recognition, predictive policing, surveillance, ALPR, body cameras, drones, robots, civil rights, privacy, policy, research
6. needs_review: 1 if the article seems tangentially related or needs human review, 0 otherwise`,
  },
  'force-science': {
    topic: 'force-science',
    name: 'Force Science News',
    queries: [
      'police use of force research',
      'law enforcement deadly force',
      'officer involved shooting',
      'police training force',
      'use of force policy',
      'police force science',
    ],
    outputFile: 'force-science-news.json',
    dbFile: 'force-science-news.db',
    systemPrompt: `You are an expert analyst categorizing news articles about police use of force and force science research. Analyze the article and provide:
1. story_type: "research" (academic/studies), "incident" (specific use of force events), "investigative" (in-depth reporting), or "general" (news coverage)
2. relevance_score: 0.0-1.0 indicating how relevant this is to police use of force or force science
3. key_entities: comma-separated list of key organizations, researchers, or agencies mentioned
4. location: city/state/country if mentioned, or null
5. tags: array of 1-5 relevant tags from: use of force, deadly force, training, policy, research, shooting, taser, restraint, de-escalation, body cameras, accountability
6. needs_review: 1 if the article seems tangentially related or needs human review, 0 otherwise`,
  },
  'k9': {
    topic: 'k9',
    name: 'Police K9 Incidents',
    queries: [
      'police K9 bite',
      'police dog attack',
      'K9 unit incident',
      'police canine injury',
      'police dog deployment',
    ],
    outputFile: 'k9-incidents.json',
    dbFile: 'k9-incidents.db',
    systemPrompt: `You are an expert analyst categorizing news articles about police K9 (canine) units and incidents. Analyze the article and provide:
1. story_type: "research" (academic/studies), "incident" (specific K9 events), "investigative" (in-depth reporting), or "general" (news coverage)
2. relevance_score: 0.0-1.0 indicating how relevant this is to police K9 operations
3. key_entities: comma-separated list of key organizations, agencies, or individuals mentioned
4. location: city/state/country if mentioned, or null
5. tags: array of 1-5 relevant tags from: K9 bite, K9 deployment, training, policy, lawsuit, injury, search, narcotics, tracking, handler
6. needs_review: 1 if the article seems tangentially related or needs human review, 0 otherwise`,
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
