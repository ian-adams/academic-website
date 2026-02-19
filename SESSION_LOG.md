## Session: 2026-02-18 21:00

### Completed
- Built complete "Killing Cascade" interactive dashboard from plan through deployment (9 commits)
- Data prep script: fits M5 logistic model on 1,857 CA DOJ cases, outputs de-identified JSON
- SVG chalk outline component with randomized wound marker placement within body regions
- Full quiz flow: start → 5-case session → reveal with model comparison → results with 3-way scoring
- Supabase tracking: cascade_sessions + cascade_responses tables (SQL created, user ran in Supabase)
- Netlify functions for submit/stats endpoints
- Comprehensive frontend design review via /frontend-design: fixed contrast (WCAG AA), typography (font-serif consistency), RevealCard redesign, responsive grid, focus-visible states
- Added coauthor's "Why Only California?" big-picture takeaway (CA+TX collect nonfatal, CA uniquely collects wound location)
- Made paper links prominent button-style on start and results screens

### Key Decisions
- Front-only silhouette (rear wounds mapped to nearest front region)
- 5 cases per session (reduced from 10 per user request)
- Seeded PRNG for wound marker randomization (same case always renders same positions)
- Pre-computed predicted probabilities in Python rather than reimplementing logistic model in JS
- Direct push to master (no feature branch) per user workflow

### Next Steps
- Monitor Supabase data collection — verify visitor accuracy stats populate correctly
- Consider adding per-case "X% of visitors got this right" stat on reveal cards
- Light mode testing still incomplete — dark-themed components should be fine but page surrounds unverified

### Open Questions
- Raw CA data has no links to investigations/news — cross-referencing would require manual work
- The 0.92 SE correction in PerCapitaChart (unrelated) still needs researcher verification

---

## Session: 2026-02-10 09:40

### Completed
- Ran `/preflight` — all tools healthy, no interrupted work
- Ran `/claude-automation-recommender` — analyzed codebase and generated recommendations
- Created project `CLAUDE.md` with full project conventions (Astro, content collections, scrapers, Netlify, Supabase)
- Added context7 MCP server to `.mcp.json` (project-level) for live docs lookup
- Added GitHub MCP server to `~/.claude.json` (user-level) with PAT for cross-project use
- Created `/scrape-news` skill for running news scrapers with review/commit workflow
- Created `/new-publication` skill for creating publication entries from DOI/OpenAlex
- Created `.claude/settings.json` with hooks: PreToolUse blocks .env/lock edits, PostToolUse validates publication frontmatter
- Created `dashboard-reviewer` subagent for chart accessibility and data correctness reviews

### Key Decisions
- GitHub MCP stored at user level (`~/.claude.json`) instead of project `.mcp.json` to avoid committing PAT to git
- PostToolUse hook validates publication frontmatter (title, authors, date) rather than running `astro check` (too slow per-edit)
- Skills set to `disable-model-invocation: true` (user-only) since both involve side effects (commits, file creation)

### Next Steps
- Restart Claude Code to pick up new MCP servers (context7, GitHub)
- Test `/scrape-news` and `/new-publication` skills in a future session
- Consider rotating GitHub PAT (was shared in chat)

### Open Questions
- None

## Session: 2026-02-10 evening

### Completed
- Fixed Claude Code hooks settings format in `.claude/settings.json`
- Migrated from old flat hook format (string `matcher` + top-level `command`) to new structured format (`matcher.tools` array + `hooks` array with `type`/`command` objects)
- Both PreToolUse (.env protection) and PostToolUse (publication frontmatter validation) hooks updated

### Key Decisions
- Kept all hook logic identical; only restructured to match new schema
- PreToolUse matcher: `["Edit", "Write"]` (was `"Edit|Write"` string)
- PostToolUse matcher: `["Write"]` (was `"Write"` string)

### Next Steps
- Verify hooks work correctly in a new Claude Code session

### Open Questions
- None

## Session: 2026-02-10 (hooks fix round 2)

### Completed
- Fixed `.claude/settings.json` hooks — still erroring after previous "fix"
- Root cause: `matcher` must be a **regex string**, not an object with `tools` array
- Previous session incorrectly changed `"Edit|Write"` → `{"tools": ["Edit", "Write"]}`, which is invalid
- Reverted: PreToolUse matcher back to `"Edit|Write"`, PostToolUse matcher back to `"Write"`
- Confirmed correct format via official Claude Code hooks documentation

### Key Decisions
- The hooks docs are clear: `matcher` is always a regex string (e.g., `"Bash"`, `"Edit|Write"`, `"mcp__.*"`)

### Next Steps
- Verify hooks fire correctly in next session

### Open Questions
- None

## Session: 2026-02-10 (doctor fixes)

### Completed
- Fixed MCP server configs for Windows: added `cmd /c` wrapper to `npx` commands in both `~/.claude.json` (GitHub server) and `.mcp.json` (context7 server)
- Added YAML frontmatter (`name`, `description`, `tools`) to `.claude/agents/dashboard-reviewer.md`

### Key Decisions
- Used lowercase-hyphenated name format (`dashboard-reviewer`) to match other working agent files
- Wrote agent file with LF line endings via Python to rule out CRLF parser issues

### Next Steps
- Re-run `/doctor` after full CLI restart to see if agent frontmatter warning clears
- If still failing, may be a Claude Code parser bug — consider filing an issue

### Open Questions
- Why does `/doctor` still report "Missing required 'name' field" when the frontmatter is verified correct? Tried multiple write methods, encoding checks, and format variations — none resolved it. Full CLI restart may be needed.

## Session: 2026-02-10 (CLAUDE.md audit & MCP test)

### Completed
- Ran `/preflight` — all tools healthy, clean working tree, no interrupted work
- Fixed preflight to avoid broad glob patterns (`**/*.qmd`, `**/*.R`) that crawled outside the project into Dropbox
- Ran `/claude-md-improver` — audited CLAUDE.md (scored B, 78/100)
- Updated CLAUDE.md: synced publication/post schemas with actual `config.ts` (added 10+ missing fields)
- Added Gotchas section to CLAUDE.md (Plotly SSR config, tsx runner, no .env in repo)
- Added `npm install` to dev commands
- Updated MEMORY.md with preflight/tool-usage lessons (scope globs, simple bash, skip irrelevant checks)
- Marked dashboard-reviewer.md /doctor issue as RESOLVED in MEMORY.md
- Tested GitHub MCP server — confirmed working (listed commits, PRs, issues via `mcp__github__*` tools)
- Reviewed all PRs: 0 open, 10 most recent all merged (Jan 18–27)

### Key Decisions
- Preflight should only check tools relevant to the known project stack (node, npm, python, gh) — skip quarto, R, pdflatex
- Glob patterns must be scoped to known project subdirs to prevent filesystem crawl

### Next Steps
- Test `/scrape-news` and `/new-publication` skills
- Consider testing `npm run build` to verify site builds cleanly with current state

### Open Questions
- None

## Session: 2026-02-10 (new publication)

### Completed
- Used `/new-publication` skill with DOI `10.1016/j.jcrimjus.2026.102600`
- Fetched metadata from OpenAlex API — title, authors, date, journal all pulled automatically
- Abstract not available via OpenAlex, CrossRef, or ScienceDirect (403 blocked) — user provided manually
- Created `src/content/publications/W7125487197.md` (Mourtgos & Adams, J. Criminal Justice 103)
- Committed and pushed to master

### Key Decisions
- ScienceDirect blocks automated fetches (403) — abstract must be provided manually for Elsevier articles

### Next Steps
- Test `/scrape-news` skill
- Consider testing `npm run build` to verify site builds with new publication

### Open Questions
- None

## Session: 2026-02-10 (citation automation + dashboard review)

### Completed
- Implemented `scripts/update-publication-citations.py` — OpenAlex primary (batch API, no auth) + Google Scholar fallback
- Added `requests>=2.31.0` to `scripts/requirements.txt`
- Integrated citation step into `.github/workflows/update-publications.yml` (weekly Sunday 3AM UTC)
- Ran locally: 106 pubs updated, Scholar fallback found 7 additional papers with citations
- Merged PR #67: `Add automated per-publication citation updates`
- Updated CLAUDE.md with citation script docs, dev command, and gotchas
- Ran `dashboard-reviewer` agent on all 32 dashboard components (4 parallel review agents)
- Compiled full review report: 7 critical, 30+ warning, 25+ info, 15+ suggestion
- Fixed all issues via 4 parallel code-fix agents across 28 files:
  - Critical data bugs: CriminalChargesChart inverted logic, AgeRaceChart NaN, MentalHealthChart div/zero, DisparityBenchmarkSimulator "Odds Ratio" → "Rate Ratio", JudgmentQuiz "National sample" → "Public sample (SC)", USMapChart hardcoded DOM id
  - Colorblind safety: race palette Hispanic green→orange, FleeingChart green→blue, DemographicExplorer green→blue
  - Dark mode contrast: navy→indigo-400 (ArmedStatus/Weapons), dark green→bright green (BodyCamera), CARTO dark tiles (USMap)
  - Accessibility: ARIA tabs on 5 dashboards, ChartCard figure wrapper, spinners, progress bars, radiogroups, fieldset/legend, slider labels, select/label linking, SVG/emoji aria-hidden, removed dead isDark state
  - Other: WeaponsChart y-axis reversed, HeatmapChart null impossible dates, timezone-safe date parsing, canvas map renderer
- Merged PR #68: `Fix dashboard data bugs, colorblind safety, dark mode contrast, and accessibility`

### Key Decisions
- OpenAlex as primary citation source with Scholar as best-effort fallback
- Orange (#f97316) for Hispanic in race palette — maximally distinguishable from rose red
- Renamed "Odds Ratio" to "Rate Ratio" in DisparityBenchmarkSimulator (formula computes rate ratio)
- Left PerCapitaChart 0.92 SE correction factor as-is with documentation comment
- Used 4 parallel agents with non-overlapping file sets to avoid merge conflicts

### Next Steps
- Extract shared `PlotWrapper`, `useDarkMode()` hook, and `TabNav` component (DRY refactoring)
- Add `React.memo` to chart exports to prevent expensive Plotly re-renders
- BadApplesSimulator O(n*m) inner loop could freeze UI — consider Web Worker
- Verify PerCapitaChart 0.92 SE correction factor with researcher

### Open Questions
- Is the 0.92 SE correction in PerCapitaChart a design effect adjustment? Needs researcher confirmation.

## Session: 2026-02-10 (MPV workflow automation)

### Completed
- Created `.github/workflows/update-mpv-data.yml` — daily workflow at 8 AM UTC
- Updated `scripts/requirements.txt` — added `pandas>=2.0.0`, `openpyxl>=3.1.0`
- Verified `preprocess-mpv-data.py` runs locally (14,941 records, fresh timestamp)
- Committed and pushed to master
- Triggered workflow manually via `gh workflow run` — all steps passed in 23s
- Confirmed live dashboard shows updated data

### Key Decisions
- Scheduled at 8 AM UTC to stagger before news scrapers (9-12 UTC)
- No API secrets needed — MPV Excel file is a public download
- Used Python inline in summary step instead of `jq` since Python is already set up

### Next Steps
- Fix `datetime.utcnow()` deprecation in `preprocess-mpv-data.py` line 222
- Monitor first few automated runs for MPV Excel download reliability

### Open Questions
- None

## Session: 2026-02-10 (frontend design — comprehensive fixes)
*Backfilled — session closed without /wrapup*

### Completed
- Ran `/frontend-design` skill — comprehensive frontend audit and fixes across 25 files (PR #70, merged)
- **Accessibility**: skip-to-content link, global focus-visible indicators, header keyboard navigation with full ARIA support, search input aria-labels, prefers-reduced-motion, WCAG-compliant 44px footer touch targets
- **Design system**: unified button classes on homepage, consistent font-bold headings, badge component classes, footer contrast fix (gray-500 → gray-600 for 5.74:1 ratio)
- **Performance**: moved Google Fonts from render-blocking CSS @import to `<link>` with preconnect, added avatar width/height to prevent CLS
- **UX polish**: smooth mobile menu animation (grid-rows transition), inter-dashboard pill navigation (`DashboardNav.astro`) across all 5 dashboards, extracted shared `useDarkMode` hook from 10 dashboard components
- **Header rewrite** (177 lines changed): full keyboard nav, dropdown with Enter/Space/Escape/Arrow keys, mobile menu with aria-expanded

### Key Decisions
- Extracted `useDarkMode.ts` shared hook (was duplicated across 10 dashboard components)
- Created `DashboardNav.astro` pill navigation component for cross-dashboard navigation
- Footer social icons sized to 44px minimum touch target per WCAG 2.1

### Next Steps
- Run Lighthouse audit to confirm accessibility score 95+
- Test screen reader flow on key pages
- Extract shared `PlotWrapper` and `TabNav` components (DRY refactoring — still pending from dashboard review session)

### Open Questions
- None

## Session: 2026-02-10 (quick checkup)

### Completed
- Ran `/preflight` — all tools healthy, clean working tree, no interrupted work
- Identified previous session (frontend design, PR #70) closed without `/wrapup`
- Backfilled SESSION_LOG.md entry for the frontend design session from PR #70 metadata

### Key Decisions
- None

### Next Steps
- Run Lighthouse audit to confirm a11y improvements from PR #70
- Extract shared `PlotWrapper` and `TabNav` components (DRY — carried forward)
- Test `/scrape-news` skill (carried forward)

### Open Questions
- None
