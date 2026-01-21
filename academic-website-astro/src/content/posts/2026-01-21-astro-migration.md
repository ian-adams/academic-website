---
title: "Website Migration: Hugo to Astro"
subtitle: "A complete rebuild of ianadamsresearch.com"
date: 2026-01-21
tags: ["website", "astro", "technology", "migration"]
categories: ["meta"]
---

Today marks a significant milestone for this website: a complete migration from [Hugo](https://gohugo.io/) (with the Academic theme) to [Astro](https://astro.build/), a modern static site generator.

## Why the Change?

The original Hugo Academic site served well since 2020, but several factors motivated this migration:

- **Maintenance burden**: The Academic theme became increasingly complex and difficult to customize
- **Modern tooling**: Astro offers better support for interactive components (React) while maintaining fast static site performance
- **Dashboard needs**: The new MPV Dashboard required interactive Plotly.js charts that work better with React islands
- **Developer experience**: Astro's file-based routing and component model are more intuitive

## What's New

### Interactive Dashboard
The [MPV Dashboard](/dashboard) now features 19 interactive Plotly.js visualizations analyzing police violence data. Filters for year, race, and state let visitors explore the data dynamically.

### News Feeds
Four curated news feeds aggregate research-relevant content:
- [AI in Policing](/ai-news)
- [K9 Incidents](/k9-incidents)
- [Force Science](/force-science-news)
- [Media Mentions](/media)

### Modern Stack
- **Astro 5.x** - Static site generation with island architecture
- **React 18** - Interactive components where needed
- **Tailwind CSS** - Utility-first styling with dark mode support
- **Plotly.js** - Publication-quality interactive charts
- **MDX** - Markdown with component support

### Preserved Content
All 105 publications were migrated with their metadata intact, pulled from OpenAlex for accurate citation information.

## Technical Details

The migration was assisted by Claude (Anthropic's AI), which helped:
- Design the new site architecture
- Create React dashboard components
- Write data preprocessing scripts
- Debug deployment issues

The site continues to be hosted on Netlify with automatic deployments from GitHub.

## Looking Forward

This new foundation makes it easier to add features like:
- More interactive data visualizations
- Enhanced publication filtering
- Additional research tools

The [source code](https://github.com/ian-adams/academic-website) remains open for anyone interested in the implementation.

---

*This post serves as a historical marker for the January 2026 migration from Hugo to Astro.*
