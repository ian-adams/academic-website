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
