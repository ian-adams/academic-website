# Academic Website - Ian T. Adams, Ph.D.

## Project Overview
Astro 5 static site for an academic researcher (criminology/policing). Deployed on Netlify.
- **Site URL**: https://ianadamsresearch.com
- **Framework**: Astro 5 (static output) + React 18 + Tailwind CSS 3
- **Hosting**: Netlify with serverless functions (esbuild bundler)
- **Database**: Supabase (quiz response storage)
- **Content**: Astro Content Collections (markdown)

## Architecture

### Directory Structure
```
src/
  components/     # Astro (.astro) and React (.tsx) components
    common/       # Header, Footer, ThemeToggle
    dashboard/    # Interactive data viz (Plotly, Leaflet, React)
      charts/     # Individual chart components
    news/         # NewsFeedClient (React)
    publications/ # PublicationsSearch (React)
  content/        # Astro Content Collections
    posts/        # Blog posts (markdown)
    publications/ # Academic publications (markdown, ~100+ files)
  data/           # Site config (site.ts)
  layouts/        # BaseLayout, PostLayout, PublicationLayout
  pages/          # Astro pages and routes
    dashboard/    # Interactive dashboard pages
  styles/         # Global CSS
  types/          # TypeScript declarations
scripts/
  update-publication-citations.py  # Weekly citation updater (OpenAlex + Scholar)
  fetch-scholar-metrics.py         # Weekly h-index/i10/total citation fetcher
  scrapers/       # News scraper system (tsx)
    lib/          # Scraper modules (newsapi, anthropic, storage, types)
netlify/
  functions/      # Serverless quiz endpoints (Supabase backend)
    lib/          # Shared function utilities
```

### Content Collections
Publications schema (`src/content/config.ts`):
- Required: `title`, `authors` (string[]), `date`
- Optional: `publication`, `publication_short`, `publication_types` (string[]), `publishDate`, `abstract`, `summary`, `featured`, `url_pdf`, `url_code`, `url_dataset`, `url_poster`, `url_project`, `url_slides`, `url_source`, `url_video`, `projects` (string[]), `tags`, `categories`, `links`, `image`
- Filename convention: `W{openalex_id}.md`

Posts schema: `title`, `date`, optional `subtitle`, `summary`, `authors`, `tags`, `categories`, `draft`, `featured`, `lastmod`, `image`, `projects`

### News Scraper System
Located in `scripts/scrapers/`. Uses NewsAPI + Anthropic Claude for article curation.
- **Topics**: `ai-police`, `force-science`, `k9`, `media-mentions`
- **Run**: `npm run scrape:<topic>` (e.g., `npm run scrape:k9`)
- **Env vars needed**: `NEWSAPI_KEY`, `ANTHROPIC_API_KEY`
- **Output**: JSON feed, RSS XML, SQLite archive in `public/data/`
- Relevance threshold: 0.6

### Netlify Functions
Quiz endpoints at `/api/quiz/{name}/{action}`:
- `quiz-fuckulator-submit`, `quiz-fuckulator-stats`
- `quiz-judgment-submit`, `quiz-judgment-stats`
- Backend: Supabase via `netlify/functions/lib/supabase.ts`

## Development Commands
```bash
npm install          # Install dependencies (first time)
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run scrape:k9    # Run a specific scraper
python scripts/update-publication-citations.py  # Update per-publication citation counts
```

## Gotchas
- **Plotly SSR**: `astro.config.mjs` has special Vite config — `react-plotly.js` is in `ssr.noExternal` and `plotly.js-dist-min` is in `optimizeDeps.exclude`. Required for build to work.
- **Scrapers use `tsx`**: The scraper scripts run via `tsx` (TypeScript execute), a project dependency. Don't replace with `ts-node`.
- **No `.env` in repo**: API keys (`NEWSAPI_KEY`, `ANTHROPIC_API_KEY`) are set in the shell environment, not in a `.env` file.
- **Citation line formats**: Publication body uses `**Citations:** N (as of Month Year)` or bare `**Citations:** N`. The update script's regex handles both.
- **OpenAlex batch limit**: API filter param accepts max ~50 pipe-separated IDs per call. Script batches automatically.

## Conventions
- React components use `.tsx`, Astro components use `.astro`
- Dashboard charts are in `src/components/dashboard/charts/` and use react-plotly.js
- Interactive dashboards use `client:load` or `client:visible` hydration directives
- Tailwind for styling; `@tailwindcss/typography` for prose content
- Static output mode (no SSR) - all pages pre-rendered at build time
- Publication types: '1' (conference), '2' (journal), '3' (preprint/working paper)
