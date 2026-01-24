#!/usr/bin/env npx tsx
/**
 * Cleanup script - removes stories with relevance_score < 0.6 from feeds
 *
 * Usage:
 *   npx tsx scripts/scrapers/cleanup-low-relevance.ts
 *   npx tsx scripts/scrapers/cleanup-low-relevance.ts --dry-run
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const RELEVANCE_THRESHOLD = 0.6;

const FEEDS = [
  'ai-police-news.json',
  'force-science-news.json',
  'k9-incidents.json',
  'media-mentions.json',
];

interface NewsStory {
  id: string;
  url: string;
  title: string;
  source: string;
  date: string;
  relevance_score?: number;
  [key: string]: unknown;
}

interface NewsFeed {
  updated: string;
  count: number;
  stories: NewsStory[];
}

function cleanupFeed(filePath: string, dryRun: boolean): { removed: number; kept: number } {
  const content = readFileSync(filePath, 'utf-8');
  const feed: NewsFeed = JSON.parse(content);

  const originalCount = feed.stories.length;

  // Filter stories with relevance >= threshold
  const relevantStories = feed.stories.filter(
    (s) => (s.relevance_score ?? 0) >= RELEVANCE_THRESHOLD
  );

  const removed = originalCount - relevantStories.length;

  if (!dryRun && removed > 0) {
    feed.stories = relevantStories;
    feed.count = relevantStories.length;
    feed.updated = new Date().toISOString();

    writeFileSync(filePath, JSON.stringify(feed, null, 2));
  }

  return { removed, kept: relevantStories.length };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`\n=== Cleanup Low-Relevance Stories ===`);
  console.log(`Threshold: >= ${RELEVANCE_THRESHOLD}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify files)'}\n`);

  const dataDir = join(process.cwd(), 'public', 'data');
  let totalRemoved = 0;
  let totalKept = 0;

  for (const feedFile of FEEDS) {
    const filePath = join(dataDir, feedFile);

    try {
      const { removed, kept } = cleanupFeed(filePath, dryRun);
      totalRemoved += removed;
      totalKept += kept;

      const action = dryRun ? 'Would remove' : 'Removed';
      console.log(`${feedFile}:`);
      console.log(`  ${action} ${removed} stories (keeping ${kept})`);
    } catch (error) {
      console.error(`Error processing ${feedFile}:`, error);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total ${dryRun ? 'would remove' : 'removed'}: ${totalRemoved} stories`);
  console.log(`Total kept: ${totalKept} stories`);

  if (dryRun) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }
}

main();
