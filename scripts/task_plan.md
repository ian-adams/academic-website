# Task Plan: Implement Semantic Scholar API for Publications Tracker

## Goal
Replace unreliable `scholarly` library with Semantic Scholar API to fetch Ian Adams' publications reliably.

## Context
- `scholarly` library fails even with proxies (ScraperAPI, free proxies)
- Google Scholar actively blocks scraping from GitHub Actions
- Need a free, reliable alternative

## Phases

- [x] Phase 1: Research alternatives to scholarly
- [x] Phase 2: Review planning methodology (Manus-style)
- [x] Phase 3: Find Ian Adams' Semantic Scholar author ID (auto-discovery implemented)
- [x] Phase 4: Implement Semantic Scholar API fetcher
- [x] Phase 5: Update scholar_tracker.py
- [x] Phase 6: Update requirements.txt
- [ ] Phase 7: Test and push changes

## Current Status
**Phase 7: Test and push changes**

## Key Decisions
- Using Semantic Scholar API (free, official, no blocking)
- Python library: `semanticscholar` from PyPI
- Will preserve existing synopsis generation and Hugo page creation

## Errors Encountered
1. `scholarly` + httpx 0.28.0 incompatibility: "Client.__init__() got an unexpected keyword argument 'proxies'"
   - Fixed by pinning httpx==0.27.2
2. `scholarly` + ScraperAPI: "'NoneType' object has no attribute 'get'"
   - Root cause: Google Scholar returning empty/blocked responses despite proxy
   - Solution: Switch to Semantic Scholar API
