#!/usr/bin/env npx tsx
/**
 * Regenerate RSS feeds from JSON files
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateRssFeed, loadFeed } from './lib/storage.js';
import { TOPICS } from './lib/types.js';

const dataDir = join(process.cwd(), 'public', 'data');

for (const [key, config] of Object.entries(TOPICS)) {
  const jsonPath = join(dataDir, config.outputFile);
  const xmlPath = join(dataDir, config.outputFile.replace('.json', '.xml'));

  try {
    const feed = loadFeed(jsonPath);
    if (!feed) {
      console.log(`Skipping ${key}: no feed found`);
      continue;
    }

    const rss = generateRssFeed(
      feed,
      config.name,
      `${config.name} - automated news feed`,
      `https://ianadamsresearch.com/${config.topic}`
    );

    writeFileSync(xmlPath, rss);
    console.log(`Regenerated ${xmlPath} (${feed.count} stories)`);
  } catch (error) {
    console.error(`Error regenerating ${key}:`, error);
  }
}

console.log('\nDone!');
