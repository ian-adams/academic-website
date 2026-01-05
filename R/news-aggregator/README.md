# AI Police News Aggregator

Automated news aggregator for tracking developments in artificial intelligence for police report writing and documentation.

## Overview

This system automatically discovers, filters, and presents news stories about AI-assisted report writing in law enforcement. It monitors multiple sources including:

- Law enforcement technology outlets (Police1, GovTech, etc.)
- General technology news (Wired, MIT Tech Review, Ars Technica, The Verge)
- Civil liberties organizations (ACLU, EFF, Brennan Center)
- Government and policy sources (NextGov, FCW)
- AI-focused news outlets

Stories are filtered for relevance using keyword matching and scoring, then classified by type (incident, policy, vendor, research, opinion).

## Features

- **Automated Daily Updates**: Runs via GitHub Actions
- **Multiple Sources**: RSS feeds + Google News + NewsAPI (optional)
- **Smart Filtering**: Relevance scoring to surface the most pertinent stories
- **Deduplication**: Tracks stories across sources to avoid duplicates
- **Web Integration**: Generates JSON/RSS feeds for your Hugo website
- **Manual Review Queue**: Flags borderline stories (0.4-0.7 relevance score)

## Directory Structure

```
R/news-aggregator/
├── utils.R                 # Helper functions and utilities
├── scrape_rss.R           # RSS feed scraping
├── scrape_newsapi.R       # NewsAPI integration
├── process_stories.R      # Filtering and classification
├── generate_output.R      # JSON/RSS/markdown generation
├── run_pipeline.R         # Main orchestration script
└── README.md              # This file

config/
└── news-sources.yaml      # Configuration: RSS feeds, search terms

data/ai-police-news/
├── stories.sqlite         # Story database (persistent)
├── needs_review.json      # Stories flagged for review
└── logs/                  # Run logs

static/data/
├── ai-police-news.json    # JSON feed for website
└── ai-police-news.xml     # RSS feed

content/ai-news/
└── index.md               # Hugo content page

layouts/ai-news/
└── single.html            # Custom layout for news page
```

## Setup

### 1. Install R Dependencies

```r
install.packages(c(
  'here',
  'yaml',
  'dplyr',
  'tidyr',
  'stringr',
  'purrr',
  'lubridate',
  'httr2',
  'jsonlite',
  'xml2',
  'tidyRSS',
  'DBI',
  'RSQLite',
  'digest'
))
```

### 2. (Optional) Configure NewsAPI

NewsAPI provides access to more sources but requires an API key. The free tier allows 100 requests/day, which is plenty for this use case.

1. Sign up at https://newsapi.org (free tier)
2. Add your API key to GitHub repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Add new secret: `NEWSAPI_KEY` = your API key

If you don't want to use NewsAPI, set `newsapi.enabled: false` in `config/news-sources.yaml`.

### 3. Configure Sources (Optional)

Edit `config/news-sources.yaml` to:
- Add or remove RSS feeds
- Modify search terms
- Adjust relevance thresholds
- Change output settings

### 4. Enable GitHub Actions

The workflow file `.github/workflows/update-ai-news.yml` is already configured to:
- Run daily at 9 AM UTC (4 AM EST)
- Allow manual triggering
- Cache the database between runs
- Commit changes back to the repository

Make sure GitHub Actions is enabled in your repository settings.

## Running Locally

### Test the Pipeline

```r
# From the project root directory
setwd("/path/to/academic-website")

# Run the pipeline
source("R/news-aggregator/run_pipeline.R")
```

This will:
1. Scrape all configured sources
2. Process and filter stories
3. Update the database
4. Generate JSON/RSS outputs
5. Create a review report

### View the Results

After running, check:
- `static/data/ai-police-news.json` - Stories for website
- `static/data/ai-police-news.xml` - RSS feed
- `data/ai-police-news/needs_review.json` - Stories to review
- `data/ai-police-news/logs/` - Execution logs

### Build and Preview Website

```bash
# Build Hugo site
hugo

# Or serve locally
hugo server
```

Then visit http://localhost:1313/ai-news/

## Manual Review Process

Stories with relevance scores between 0.4-0.7 are flagged for review in `data/ai-police-news/needs_review.json`.

To review stories:

```r
library(jsonlite)
library(DBI)
library(RSQLite)

# Read review queue
review <- fromJSON("data/ai-police-news/needs_review.json")
print(review$stories)

# Connect to database
con <- dbConnect(RSQLite::SQLite(), "data/ai-police-news/stories.sqlite")

# Mark story as reviewed and adjust if needed
dbExecute(con,
  "UPDATE stories SET reviewed = 1, published_on_site = 1 WHERE id = ?",
  params = list("story_id_here")
)

# Or unpublish a story
dbExecute(con,
  "UPDATE stories SET published_on_site = 0 WHERE id = ?",
  params = list("story_id_here")
)

dbDisconnect(con)

# Re-run output generation
source("R/news-aggregator/utils.R")
source("R/news-aggregator/generate_output.R")
con <- dbConnect(RSQLite::SQLite(), "data/ai-police-news/stories.sqlite")
generate_all_outputs(con)
dbDisconnect(con)
```

## Customization

### Add More Search Terms

Edit `config/news-sources.yaml` and add to the `search_terms` list:

```yaml
search_terms:
  - "your new search term"
  - "another term"
```

### Add More RSS Feeds

```yaml
rss_feeds:
  - name: "Source Name"
    url: "https://example.com/rss"
```

### Adjust Relevance Scoring

Modify `calculate_relevance_score()` in `R/news-aggregator/utils.R` to:
- Change keyword weights
- Add new high-relevance terms
- Adjust score thresholds

### Modify Story Classification

Edit `classify_story_type()` in `R/news-aggregator/utils.R` to change how stories are categorized.

## Troubleshooting

### No stories found

- Check that RSS feeds are accessible
- Verify search terms are not too specific
- Review logs in `data/ai-police-news/logs/`
- Lower `min_relevance_score` in config

### GitHub Actions failing

- Check that R dependencies installed successfully
- Verify NewsAPI key is set (if enabled)
- Review workflow logs in Actions tab
- Check for network/API rate limit issues

### Stories not appearing on website

- Verify JSON file was generated in `static/data/`
- Check relevance score meets minimum threshold
- Ensure `published_on_site = 1` in database
- Clear browser cache and rebuild Hugo site

### Database issues

- Database is SQLite and stored in `data/ai-police-news/stories.sqlite`
- To reset completely: delete the .sqlite file and re-run pipeline
- To inspect: use DB Browser for SQLite or R's DBI package

## Maintenance

### Regular Tasks

- **Weekly**: Review flagged stories in `needs_review.json`
- **Monthly**: Check logs for errors or missed stories
- **Quarterly**: Review and update search terms and RSS feeds
- **Annually**: Evaluate new data sources and vendors to track

### Database Cleanup

```r
library(DBI)
library(RSQLite)

con <- dbConnect(RSQLite::SQLite(), "data/ai-police-news/stories.sqlite")

# Remove very old stories (optional)
dbExecute(con, "DELETE FROM stories WHERE date_published < date('now', '-2 years')")

# Vacuum to reclaim space
dbExecute(con, "VACUUM")

dbDisconnect(con)
```

## Support

For issues or questions:
1. Check logs in `data/ai-police-news/logs/`
2. Review GitHub Actions workflow runs
3. Verify configuration in `config/news-sources.yaml`

## License

Part of the Ian T. Adams academic website project.
