---
name: new-publication
description: Create a new publication entry from DOI or citation metadata
disable-model-invocation: true
---

# New Publication

Create a properly formatted publication markdown file in `src/content/publications/`.

## Arguments
- `<doi_or_url>`: A DOI (e.g., `10.1111/1745-9133.12659`) or OpenAlex URL
- Or provide citation details manually if no DOI available

## Workflow

### 1. Fetch metadata
If a DOI is provided:
- Use the OpenAlex API to fetch metadata: `https://api.openalex.org/works/doi:<doi>`
- Extract: title, authors, date, publication venue, abstract, OpenAlex ID
- If OpenAlex fails, try CrossRef: `https://api.crossref.org/works/<doi>`

If an OpenAlex ID is provided:
- Fetch directly: `https://api.openalex.org/works/<id>`

If manual entry, ask the user for: title, authors, date, publication venue, DOI/URL

### 2. Determine filename
- Use OpenAlex work ID if available: `W<id>.md` (e.g., `W4414900614.md`)
- If no OpenAlex ID, use a slugified title: `<slug>.md`
- Check that the file doesn't already exist in `src/content/publications/`

### 3. Create the publication file
Write a markdown file with this frontmatter structure:

```yaml
---
title: "<Title>"
authors:
- Author One
- Author Two
date: 'YYYY-MM-DD'
publishDate: 'YYYY-MM-DD'
publication_types:
- '<type>'   # '1' = conference, '2' = journal, '3' = preprint/working paper
publication: "<Journal or Venue Name>"
publication_short: ''
abstract: "<Abstract text>"
summary: ''
featured: false
url_pdf: ''
url_code: ''
url_dataset: ''
url_poster: ''
url_project: ''
url_slides: ''
url_source: <doi_url>
url_video: ''
projects: []
tags: []
categories: []
links:
- name: OpenAlex
  url: https://openalex.org/<openalex_id>
- name: DOI
  url: https://doi.org/<doi>
---

## Summary

No summary available.

## Citation Information

**Citations:** 0

[View Publication](<doi_url>)
```

### 4. Confirm with user
- Show the created file path and a preview of the frontmatter
- Ask if they want to edit any fields (tags, featured status, etc.)
- Remind them to add a summary later if abstract was unavailable

## Schema Reference
The publication content collection is defined in `src/content/config.ts`:
- Required: `title` (string), `authors` (string[]), `date` (date)
- Optional: `publication`, `abstract`, `summary`, `featured`, `url_*`, `tags`, `categories`, `links`
- `publication_types`: '1' (conference), '2' (journal), '3' (preprint)

## Notes
- Never fabricate citation data - if metadata is unavailable, leave fields empty
- Flag uncertain entries with `[VERIFY]` in the abstract or summary
- Ian T. Adams should appear in the authors list as "Ian T. Adams"
