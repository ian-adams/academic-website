# Research Notes: Publications Tracker

## Semantic Scholar API

### Key Info
- Base URL: `https://api.semanticscholar.org/graph/v1/`
- No API key required for basic use
- Rate limit: 100 requests per 5 minutes (unauthenticated)
- ~200 million papers indexed
- Python library: `semanticscholar` on PyPI

### Relevant Endpoints
1. Author search: `/author/search?query=Ian Adams`
2. Author by ID: `/author/{author_id}`
3. Author papers: `/author/{author_id}/papers`

### Paper Fields Available
- paperId, title, abstract, year, venue
- authors, citationCount, url
- publicationDate, fieldsOfStudy

### Author Fields Available
- authorId, name, affiliations
- paperCount, citationCount, hIndex
- papers (with nested fields)

## Ian Adams Identifiers
- Google Scholar ID: g9lY5RUAAAAJ
- Semantic Scholar ID: Will auto-discover by searching "Ian T. Adams" + filtering by paper count/affiliation
- Known paper on S2: "Fuck: The Police" (paperId: 41e249bc32216bc11d7f2199a33e3af85b895c14)
- Affiliation: University of South Carolina, Criminology & Criminal Justice
- Expected paper count: ~40+ peer-reviewed publications

## API Response Format
```python
# Author search returns:
{
  "total": int,
  "data": [
    {
      "authorId": "string",
      "name": "string",
      "affiliations": ["string"],
      "paperCount": int,
      "citationCount": int
    }
  ]
}

# Author papers returns:
{
  "data": [
    {
      "paperId": "string",
      "title": "string",
      "year": int,
      "citationCount": int,
      ...
    }
  ]
}
```

## Implementation Notes
- Use `requests` library (simpler than httpx for this use case)
- Fall back gracefully if Semantic Scholar doesn't have all papers
- Keep existing Claude synopsis generation logic
- Keep existing Hugo page generation logic
