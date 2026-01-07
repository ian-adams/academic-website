# Research Notes: Publications Tracker

## OpenAlex API

### Key Info
- Free, open API with no authentication required
- Rate limit: 100,000 requests per day
- Python library: `pyalex` on PyPI
- Comprehensive scholarly database

### Usage with pyalex
```python
import pyalex
from pyalex import Works, Authors

# Set email for polite pool (faster access)
pyalex.config.email = "mail@example.com"

# Get author's works
Works().filter(authorships__author__id="A5052998143").get()

# Paginate through all works
pager = Works().filter(authorships__author__id="A5052998143").paginate(per_page=200)
for page in pager:
    for work in page:
        print(work["title"])
```

### Work Fields Available
- id, doi, title, display_name
- publication_year, publication_date
- abstract_inverted_index (pyalex auto-converts to plaintext via work["abstract"])
- cited_by_count, cited_by_percentile_year
- authorships (list with author info)
- primary_location (venue/journal info)
- open_access, type

## Ian Adams Identifiers
- Google Scholar ID: g9lY5RUAAAAJ
- OpenAlex Author ID: A5052998143
- Works URL: https://openalex.org/works?page=1&filter=authorships.author.id:a5052998143
- Affiliation: University of South Carolina, Criminology & Criminal Justice

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
