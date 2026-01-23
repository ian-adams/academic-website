#!/usr/bin/env npx tsx
/**
 * News scraper script - fetches articles from NewsAPI, analyzes with Claude, and saves to JSON
 *
 * Usage:
 *   npx tsx scripts/scrapers/scrape.ts --topic ai-police
 *   npx tsx scripts/scrapers/scrape.ts --topic force-science
 *   npx tsx scripts/scrapers/scrape.ts --topic k9
 *   npx tsx scripts/scrapers/scrape.ts --topic media-mentions
 *
 * Environment variables:
 *   NEWSAPI_KEY - NewsAPI API key
 *   ANTHROPIC_API_KEY - Anthropic API key
 */

import { parseArgs } from 'util';
import { NewsAPIClient } from './lib/newsapi.js';
import { ArticleAnalyzer } from './lib/anthropic.js';
import {
  loadFeed,
  saveFeed,
  mergeFeed,
  createNewsStory,
  StoryArchive,
  generateRssFeed,
  getOutputPaths,
} from './lib/storage.js';
import { TOPICS, type NewsStory } from './lib/types.js';

async function main() {
  // Parse command line arguments
  const { values } = parseArgs({
    options: {
      topic: { type: 'string', short: 't' },
      'days-back': { type: 'string', short: 'd', default: '7' },
      'skip-analysis': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const topicKey = values.topic;
  const daysBack = parseInt(values['days-back'] ?? '7', 10);
  const skipAnalysis = values['skip-analysis'] ?? false;
  const dryRun = values['dry-run'] ?? false;

  // Validate topic
  if (!topicKey || !TOPICS[topicKey]) {
    console.error('Error: Invalid or missing topic');
    console.error('Available topics:', Object.keys(TOPICS).join(', '));
    process.exit(1);
  }

  const config = TOPICS[topicKey];
  console.log(`\n=== ${config.name} Scraper ===\n`);

  // Check environment variables
  const newsApiKey = process.env.NEWSAPI_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!newsApiKey) {
    console.error('Error: NEWSAPI_KEY environment variable is required');
    process.exit(1);
  }

  if (!anthropicApiKey && !skipAnalysis) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required (or use --skip-analysis)');
    process.exit(1);
  }

  // Calculate date range
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);

  console.log(`Searching for articles from ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);

  // Initialize clients
  const newsClient = new NewsAPIClient(newsApiKey);
  const analyzer = anthropicApiKey ? new ArticleAnalyzer(anthropicApiKey) : null;

  // Fetch articles
  console.log('\n--- Fetching articles from NewsAPI ---');
  const articles = await newsClient.searchMultipleQueries(config.queries, {
    from: fromDate.toISOString().split('T')[0],
    to: toDate.toISOString().split('T')[0],
  });

  if (articles.length === 0) {
    console.log('No new articles found');
    return;
  }

  console.log(`\nFetched ${articles.length} articles`);

  // Get output paths
  const paths = getOutputPaths(config.outputFile.replace('.json', ''));

  // Load existing feed to check for duplicates
  const existingFeed = loadFeed(paths.jsonFile);
  const existingUrls = new Set(existingFeed?.stories.map((s) => s.url) ?? []);

  // Filter out articles we already have
  const newArticles = articles.filter((a) => !existingUrls.has(a.url));
  console.log(`${newArticles.length} articles are new (${articles.length - newArticles.length} already in feed)`);

  if (newArticles.length === 0) {
    console.log('No new articles to process');
    return;
  }

  // Analyze articles with Claude
  let analysisResults = new Map<string, Awaited<ReturnType<ArticleAnalyzer['analyzeArticle']>>>();

  if (analyzer && !skipAnalysis) {
    console.log('\n--- Analyzing articles with Claude ---');
    analysisResults = await analyzer.analyzeArticles(newArticles, config.systemPrompt, {
      batchSize: 5,
      delayMs: 1000,
      onProgress: (completed, total) => {
        process.stdout.write(`\rAnalyzing: ${completed}/${total}`);
      },
    });
    console.log('\n');
  }

  // Convert to NewsStory format
  const newStories: NewsStory[] = newArticles.map((article) => {
    const analysis = analysisResults.get(article.url) ?? null;
    return createNewsStory(article, analysis);
  });

  // Filter by relevance score (keep stories with score >= 0.6)
  // Note: We no longer auto-include needs_review items - they must also meet threshold
  const relevantStories = newStories.filter(
    (s) => (s.relevance_score ?? 0) >= 0.6
  );
  console.log(`${relevantStories.length} stories pass relevance threshold (>= 0.6)`);

  if (dryRun) {
    console.log('\n--- Dry run - not saving ---');
    console.log('Would add stories:');
    relevantStories.slice(0, 5).forEach((s) => {
      console.log(`  - ${s.title} (${s.source}, score: ${s.relevance_score})`);
    });
    if (relevantStories.length > 5) {
      console.log(`  ... and ${relevantStories.length - 5} more`);
    }
    return;
  }

  // Merge with existing feed
  console.log('\n--- Saving results ---');
  const mergedFeed = mergeFeed(existingFeed, relevantStories);

  // Save JSON feed
  saveFeed(paths.jsonFile, mergedFeed);

  // Save RSS feed
  const rssFeed = generateRssFeed(
    mergedFeed,
    config.name,
    `${config.name} - automated news feed`,
    `https://ianadamsresearch.com/${config.topic}`
  );
  const { writeFileSync } = await import('fs');
  const { dirname } = await import('path');
  const { existsSync, mkdirSync } = await import('fs');
  const dir = dirname(paths.xmlFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(paths.xmlFile, rssFeed);
  console.log(`Saved RSS feed to ${paths.xmlFile}`);

  // Archive to SQLite
  try {
    const archive = new StoryArchive(paths.dbFile);
    const archivedCount = archive.addStories(relevantStories);
    console.log(`Archived ${archivedCount} new stories to ${paths.dbFile}`);
    archive.close();
  } catch (error) {
    console.error('Warning: Failed to archive to SQLite:', error);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Topic: ${config.name}`);
  console.log(`New articles fetched: ${articles.length}`);
  console.log(`New unique articles: ${newArticles.length}`);
  console.log(`Articles passing relevance filter: ${relevantStories.length}`);
  console.log(`Total stories in feed: ${mergedFeed.count}`);
}

main().catch((error) => {
  console.error('Scraper failed:', error);
  process.exit(1);
});
