/**
 * Storage utilities for reading/writing news feeds and SQLite archives
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import type { NewsStory, NewsFeed, NewsAPIArticle, ClaudeAnalysis } from './types.js';

/**
 * Generate a unique ID for a story based on its URL
 */
export function generateStoryId(url: string): string {
  return createHash('md5').update(url).digest('hex');
}

/**
 * Convert a NewsAPI article + Claude analysis to a NewsStory
 */
export function createNewsStory(
  article: NewsAPIArticle,
  analysis: ClaudeAnalysis | null
): NewsStory {
  const today = new Date().toISOString().split('T')[0];

  return {
    id: generateStoryId(article.url),
    url: article.url,
    title: article.title,
    source: article.source.name,
    date: article.publishedAt.split('T')[0],
    date_discovered: today,
    summary: formatSummary(article),
    story_type: analysis?.story_type ?? 'general',
    relevance_score: analysis?.relevance_score ?? 0.5,
    key_entities: analysis?.key_entities ?? '',
    location: analysis?.location ?? null,
    tags: analysis?.tags ?? [],
    needs_review: analysis?.needs_review ?? 1,
  };
}

/**
 * Format article into HTML summary (matches existing format)
 */
function formatSummary(article: NewsAPIArticle): string {
  return `<a href="${article.url}" target="_blank">${article.title}</a> <font color="#6f6f6f">${article.source.name}</font>`;
}

/**
 * Load existing feed from JSON file
 */
export function loadFeed(filePath: string): NewsFeed | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as NewsFeed;
  } catch (error) {
    console.error(`Failed to load feed from ${filePath}:`, error);
    return null;
  }
}

/**
 * Save feed to JSON file
 */
export function saveFeed(filePath: string, feed: NewsFeed): void {
  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(feed, null, 2));
  console.log(`Saved ${feed.count} stories to ${filePath}`);
}

/**
 * Merge new stories into existing feed, avoiding duplicates
 */
export function mergeFeed(existing: NewsFeed | null, newStories: NewsStory[]): NewsFeed {
  const existingIds = new Set(existing?.stories.map((s) => s.id) ?? []);
  const existingStories = existing?.stories ?? [];

  // Add only new stories
  const addedStories: NewsStory[] = [];
  for (const story of newStories) {
    if (!existingIds.has(story.id)) {
      addedStories.push(story);
    }
  }

  // Combine and sort by date (newest first)
  const allStories = [...addedStories, ...existingStories].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  console.log(`Added ${addedStories.length} new stories (${existingStories.length} existing)`);

  return {
    updated: new Date().toISOString(),
    count: allStories.length,
    stories: allStories,
  };
}

/**
 * SQLite database for archiving stories
 */
export class StoryArchive {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        date TEXT NOT NULL,
        date_discovered TEXT NOT NULL,
        summary TEXT,
        story_type TEXT,
        relevance_score REAL,
        key_entities TEXT,
        location TEXT,
        tags TEXT,
        needs_review INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_stories_date ON stories(date);
      CREATE INDEX IF NOT EXISTS idx_stories_source ON stories(source);
      CREATE INDEX IF NOT EXISTS idx_stories_story_type ON stories(story_type);
    `);
  }

  /**
   * Check if a story URL already exists
   */
  hasStory(url: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM stories WHERE url = ?').get(url);
    return row !== undefined;
  }

  /**
   * Add a story to the archive
   */
  addStory(story: NewsStory): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO stories
      (id, url, title, source, date, date_discovered, summary, story_type, relevance_score, key_entities, location, tags, needs_review)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      story.id,
      story.url,
      story.title,
      story.source,
      story.date,
      story.date_discovered,
      story.summary,
      story.story_type ?? null,
      story.relevance_score ?? null,
      story.key_entities ?? null,
      story.location ?? null,
      JSON.stringify(story.tags ?? []),
      story.needs_review ?? 0
    );
  }

  /**
   * Add multiple stories
   */
  addStories(stories: NewsStory[]): number {
    let added = 0;
    const addStory = this.db.transaction((story: NewsStory) => {
      if (!this.hasStory(story.url)) {
        this.addStory(story);
        added++;
      }
    });

    for (const story of stories) {
      addStory(story);
    }

    return added;
  }

  /**
   * Get all stories from archive
   */
  getAllStories(): NewsStory[] {
    const rows = this.db.prepare('SELECT * FROM stories ORDER BY date DESC').all() as Array<{
      id: string;
      url: string;
      title: string;
      source: string;
      date: string;
      date_discovered: string;
      summary: string;
      story_type: string;
      relevance_score: number;
      key_entities: string;
      location: string | null;
      tags: string;
      needs_review: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      source: row.source,
      date: row.date,
      date_discovered: row.date_discovered,
      summary: row.summary,
      story_type: row.story_type as NewsStory['story_type'],
      relevance_score: row.relevance_score,
      key_entities: row.key_entities,
      location: row.location,
      tags: JSON.parse(row.tags || '[]'),
      needs_review: row.needs_review,
    }));
  }

  /**
   * Get count of stories
   */
  getCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM stories').get() as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Generate RSS/XML feed from stories
 */
export function generateRssFeed(
  feed: NewsFeed,
  title: string,
  description: string,
  link: string
): string {
  const items = feed.stories.slice(0, 50).map((story) => {
    const pubDate = new Date(story.date).toUTCString();
    return `    <item>
      <title><![CDATA[${story.title}]]></title>
      <link>${escapeXml(story.url)}</link>
      <guid>${story.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <source>${escapeXml(story.source)}</source>
      <description><![CDATA[${story.summary}]]></description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <link>${escapeXml(link)}</link>
    <lastBuildDate>${new Date(feed.updated).toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get paths for output files
 */
export function getOutputPaths(topic: string) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = join(__dirname, '..', '..', '..');
  const dataDir = join(projectRoot, 'public', 'data');
  const dbDir = join(projectRoot, 'data', 'db');

  return {
    jsonFile: join(dataDir, `${topic}.json`),
    xmlFile: join(dataDir, `${topic}.xml`),
    dbFile: join(dbDir, `${topic}.db`),
  };
}
