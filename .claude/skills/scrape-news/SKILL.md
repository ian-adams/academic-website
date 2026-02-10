---
name: scrape-news
description: Run news scrapers for curated research feeds, review results, and commit updates
disable-model-invocation: true
---

# Scrape News

Run the news scraper pipeline for one or more topics, review the results, and commit.

## Arguments
- `<topic>`: One of `ai-police`, `force-science`, `k9`, `media-mentions`, or `all`
- `--days <n>`: Days back to search (default: 7)
- `--dry-run`: Preview without saving

## Workflow

### 1. Validate environment
- Confirm `NEWSAPI_KEY` and `ANTHROPIC_API_KEY` are set (check env, never display values)
- If missing, tell the user and stop

### 2. Run scraper(s)
If topic is `all`, run each topic sequentially. Otherwise run the specified topic:
```bash
npm run scrape:<topic>
```
Available scripts:
- `npm run scrape:ai-police`
- `npm run scrape:force-science`
- `npm run scrape:k9`
- `npm run scrape:media-mentions`

For custom days-back or dry-run, call directly:
```bash
npx tsx scripts/scrapers/scrape.ts --topic <topic> --days-back <n>
npx tsx scripts/scrapers/scrape.ts --topic <topic> --dry-run
```

### 3. Review results
- Show the user a summary: how many articles fetched, how many passed relevance filter
- List the top 5 new stories with titles, sources, and relevance scores
- Flag any stories with `needs_review: 1` for user attention

### 4. Commit and push
After user confirms the results look good:
- Stage the changed feed files: `public/data/*.json`, `public/data/*.xml`
- Do NOT stage `.db` files (SQLite archives are gitignored)
- Create a commit with message: `Update <Topic Name> news feed - <YYYY-MM-DD>`
- Ask the user if they want to push

## Output Files
Each topic produces files in `public/data/`:
- `<topic>.json` - JSON feed consumed by frontend
- `<topic>.xml` - RSS feed
- `<topic>.db` - SQLite archive (not committed)

## Notes
- The scraper uses Claude (Anthropic API) to analyze article relevance
- Relevance threshold is 0.6 - articles below this are filtered out
- Topics are defined in `scripts/scrapers/lib/types.ts`
