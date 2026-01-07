# Task Plan: Implement OpenAlex API for Publications Tracker

## Goal
Use OpenAlex API to fetch Ian Adams' publications reliably.

## Context
- `scholarly` library fails (Google Scholar blocking)
- Semantic Scholar doesn't track publications well
- OpenAlex: free, open API with generous limits
- Ian's OpenAlex Author ID: a5052998143

## Phases

- [x] Phase 1: Research alternatives to scholarly
- [x] Phase 2: Review planning methodology (Manus-style)
- [x] Phase 3: Identify OpenAlex author ID (a5052998143)
- [x] Phase 4: Research OpenAlex API structure
- [x] Phase 5: Implement OpenAlex fetcher
- [x] Phase 6: Update requirements.txt
- [x] Phase 7: Test and push changes

## Current Status
**Phase 7: Complete - Ready for GitHub Actions test**

## Key Decisions
- Using OpenAlex API (free, open, comprehensive)
- Author ID: a5052998143
- Python library: `pyalex` from PyPI
- Will preserve existing synopsis generation and Hugo page creation

## Errors Encountered
1. `scholarly` + httpx 0.28.0 incompatibility
2. `scholarly` + ScraperAPI: Google Scholar blocking
3. Semantic Scholar: poor publication coverage for this author
