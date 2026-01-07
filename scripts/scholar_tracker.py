#!/usr/bin/env python3
"""
Publications Tracker with AI Synopses

Tracks Ian Adams' publications via Semantic Scholar API, generates AI synopses
for new articles, maintains citation counts, and publishes to Hugo/Wowchemy website.

Uses Semantic Scholar API (free, reliable) instead of Google Scholar scraping.
"""

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import anthropic
import requests
import yaml

# Configuration Constants
AUTHOR_NAME = "Ian T. Adams"
AUTHOR_SEARCH_QUERY = "Ian T. Adams"
# Semantic Scholar author ID - will be discovered on first run if not set
SEMANTIC_SCHOLAR_AUTHOR_ID = None  # Set after first successful discovery

CURRENT_SYNOPSIS_PROMPT_VERSION = 1
CLAUDE_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 1024

# Rate limiting
API_DELAY_SECONDS = 1  # Semantic Scholar allows 100 req/5min unauthenticated
CLAUDE_DELAY_SECONDS = 2

# Semantic Scholar API
SEMANTIC_SCHOLAR_API_BASE = "https://api.semanticscholar.org/graph/v1"
PAPER_FIELDS = "paperId,title,abstract,year,venue,authors,citationCount,url,publicationDate,externalIds"
AUTHOR_FIELDS = "authorId,name,affiliations,paperCount,citationCount,hIndex"

# File paths (relative to repository root)
PUBLICATIONS_JSON = "data/publications.json"
RUN_HISTORY_JSON = "data/run_history.json"
CONTENT_PUBLICATION_DIR = "content/publication"

# Synopsis prompts (versioned for regeneration tracking)
SYNOPSIS_PROMPTS = {
    1: """You are summarizing an academic criminology article for a general audience interested in policing research.

Article Title: {title}
Authors: {authors}
Year: {year}
Venue: {venue}
Abstract: {abstract}

Provide a clear, accessible 2-3 sentence summary that:
1. Explains the research question or main finding
2. Highlights why this matters for understanding policing
3. Uses plain language (avoid jargon)

Be direct and informative. Do not use phrases like "this article" or "the authors."
"""
}


class ValidationError(Exception):
    """Raised when data validation fails"""
    pass


def log_info(message: str):
    """Log informational message"""
    print(f"[INFO] {message}")


def log_warning(message: str):
    """Log warning message"""
    print(f"[WARNING] {message}")


def log_error(message: str):
    """Log error message"""
    print(f"[ERROR] {message}", file=sys.stderr)


def get_current_timestamp() -> str:
    """Get current UTC timestamp in ISO 8601 format"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json_file(filepath: str) -> dict:
    """Load JSON file, return empty structure if doesn't exist"""
    path = Path(filepath)
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_json_file(filepath: str, data: dict):
    """Save data to JSON file with proper formatting"""
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def initialize_publications_data() -> dict:
    """Initialize empty publications data structure"""
    return {
        "metadata": {
            "last_updated": None,
            "total_articles": 0,
            "synopsis_prompt_version": CURRENT_SYNOPSIS_PROMPT_VERSION,
            "author_name": AUTHOR_NAME,
            "semantic_scholar_author_id": None,
            "data_source": "semantic_scholar"
        },
        "articles": {}
    }


def initialize_run_history() -> dict:
    """Initialize empty run history structure"""
    return {"runs": []}


def api_request(url: str, max_retries: int = 3) -> dict:
    """Make API request with retry logic"""
    last_error = None

    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=30)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                # Rate limited - wait and retry
                wait_time = 60  # Wait 1 minute
                log_warning(f"Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
                continue
            elif response.status_code == 404:
                log_warning(f"Resource not found: {url}")
                return None
            else:
                log_error(f"API error {response.status_code}: {response.text[:200]}")
                last_error = Exception(f"API error {response.status_code}")

        except requests.exceptions.Timeout:
            last_error = Exception("Request timed out")
            log_warning(f"Request timed out, attempt {attempt + 1}/{max_retries}")
        except requests.exceptions.RequestException as e:
            last_error = e
            log_warning(f"Request failed: {e}, attempt {attempt + 1}/{max_retries}")

        if attempt < max_retries - 1:
            wait_time = 2 ** attempt
            time.sleep(wait_time)

    if last_error:
        raise last_error
    return None


def find_author_id(author_name: str) -> str:
    """Search for author by name and return best match author ID"""
    log_info(f"Searching for author: {author_name}")

    # Search for author
    encoded_name = quote(author_name)
    url = f"{SEMANTIC_SCHOLAR_API_BASE}/author/search?query={encoded_name}&fields={AUTHOR_FIELDS}&limit=10"

    result = api_request(url)
    if not result or not result.get('data'):
        raise Exception(f"No authors found matching '{author_name}'")

    # Find best match - look for criminology/policing researcher with many papers
    candidates = result['data']
    log_info(f"Found {len(candidates)} author candidates")

    best_match = None
    best_score = 0

    for candidate in candidates:
        score = 0
        name = candidate.get('name', '').lower()
        affiliations = ' '.join(candidate.get('affiliations', [])).lower()
        paper_count = candidate.get('paperCount', 0)

        # Scoring criteria
        if 'ian' in name and 'adams' in name:
            score += 50
        if 't.' in name.lower() or 'ian t' in name.lower():
            score += 20
        if any(term in affiliations for term in ['south carolina', 'criminology', 'criminal justice', 'policing']):
            score += 30
        if paper_count >= 30:
            score += 20
        elif paper_count >= 20:
            score += 10

        log_info(f"  Candidate: {candidate.get('name')} (papers: {paper_count}, score: {score})")

        if score > best_score:
            best_score = score
            best_match = candidate

    if not best_match or best_score < 50:
        # Fall back to first result with reasonable paper count
        for candidate in candidates:
            if candidate.get('paperCount', 0) >= 20:
                best_match = candidate
                break
        if not best_match:
            best_match = candidates[0]

    author_id = best_match.get('authorId')
    log_info(f"Selected author: {best_match.get('name')} (ID: {author_id}, papers: {best_match.get('paperCount')})")

    return author_id


def fetch_author_publications(author_id: str = None) -> list:
    """Fetch all publications for the author from Semantic Scholar"""

    # If no author ID provided, search for it
    if not author_id:
        author_id = find_author_id(AUTHOR_SEARCH_QUERY)

    log_info(f"Fetching publications for author ID: {author_id}")

    # Get author's papers with pagination
    all_papers = []
    offset = 0
    limit = 100

    while True:
        url = f"{SEMANTIC_SCHOLAR_API_BASE}/author/{author_id}/papers?fields={PAPER_FIELDS}&limit={limit}&offset={offset}"

        result = api_request(url)
        if not result:
            break

        papers = result.get('data', [])
        if not papers:
            break

        all_papers.extend(papers)
        log_info(f"Fetched {len(all_papers)} papers so far...")

        # Check if there are more papers
        if len(papers) < limit:
            break

        offset += limit
        time.sleep(API_DELAY_SECONDS)  # Rate limiting

    log_info(f"Total papers fetched: {len(all_papers)}")
    return all_papers, author_id


def extract_paper_id(paper: dict) -> str:
    """Extract unique ID from paper data"""
    # Prefer Semantic Scholar paperId
    paper_id = paper.get('paperId')
    if paper_id:
        return paper_id

    # Fallback to DOI if available
    external_ids = paper.get('externalIds', {})
    if external_ids.get('DOI'):
        return f"doi_{external_ids['DOI'].replace('/', '_')}"

    # Fallback to title hash
    title = paper.get('title', '')
    if title:
        return hashlib.md5(title.encode()).hexdigest()[:16]

    # Last resort
    return hashlib.md5(str(time.time()).encode()).hexdigest()[:16]


def parse_authors_from_list(authors_list: list) -> list:
    """Parse authors from Semantic Scholar author list"""
    if not authors_list:
        return []

    return [author.get('name', 'Unknown') for author in authors_list if author.get('name')]


def generate_synopsis(paper: dict, max_retries: int = 2) -> str:
    """Generate AI synopsis for a paper using Claude API"""
    title = paper.get('title', 'Unknown')
    authors = ', '.join(parse_authors_from_list(paper.get('authors', [])))
    year = paper.get('year', 'Unknown')
    venue = paper.get('venue', 'Unknown venue')
    abstract = paper.get('abstract', 'No abstract available')

    if not abstract or abstract == 'No abstract available':
        log_warning(f"No abstract available for '{title[:40]}...', skipping synopsis")
        return ""

    prompt = SYNOPSIS_PROMPTS[CURRENT_SYNOPSIS_PROMPT_VERSION].format(
        title=title,
        authors=authors,
        year=year,
        venue=venue,
        abstract=abstract
    )

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        log_warning("ANTHROPIC_API_KEY not set, skipping synopsis generation")
        return ""

    for attempt in range(max_retries + 1):
        try:
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()

        except Exception as e:
            if attempt < max_retries:
                wait_time = 2 ** attempt
                log_warning(f"Claude API attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
            else:
                log_error(f"Claude API failed after {max_retries + 1} attempts: {e}")
                raise


def validate_data(publications: dict, old_count: int) -> bool:
    """Validate publications data before saving"""
    required_fields = ['paper_id', 'title', 'authors', 'year', 'citation_count', 'first_seen']

    for paper_id, article in publications['articles'].items():
        for field in required_fields:
            if field not in article:
                raise ValidationError(f"Missing field '{field}' in article {paper_id}")

        if not isinstance(article['authors'], list):
            raise ValidationError(f"'authors' must be list in article {paper_id}")
        if not isinstance(article['citation_count'], int):
            raise ValidationError(f"'citation_count' must be int in article {paper_id}")

    # Check no articles lost (allow small decrease due to Semantic Scholar updates)
    new_count = len(publications['articles'])
    if new_count < old_count * 0.9:  # Allow up to 10% decrease
        raise ValidationError(f"Article count decreased significantly: {old_count} -> {new_count}")

    return True


def format_date(iso_timestamp: str) -> str:
    """Format ISO timestamp to readable date"""
    if not iso_timestamp:
        return "Unknown date"
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        return dt.strftime("%B %Y")
    except (ValueError, TypeError):
        return "Unknown date"


def generate_hugo_page(paper_id: str, article: dict):
    """Generate Hugo/Wowchemy publication page for an article"""
    synopsis_text = article.get('manual_synopsis') or article.get('llm_synopsis', '')
    synopsis_type = "Manual" if article.get('manual_synopsis') else "AI-generated"

    synopsis_date = format_date(article.get('llm_synopsis_generated_date', article.get('first_seen')))
    citation_date = format_date(article.get('last_updated'))

    year = article.get('year', 2024)
    if not year or year == 0:
        year = 2024

    # Build Semantic Scholar URL
    semantic_url = f"https://www.semanticscholar.org/paper/{paper_id}" if paper_id else ""

    frontmatter = {
        'title': article.get('title', 'Unknown Title'),
        'authors': article.get('authors', []),
        'date': f"{year}-01-01",
        'publishDate': f"{year}-01-01",
        'publication_types': ['2'],
        'publication': article.get('venue', ''),
        'publication_short': '',
        'abstract': article.get('abstract', ''),
        'summary': synopsis_text,
        'featured': False,
        'url_pdf': '',
        'url_code': '',
        'url_dataset': '',
        'url_poster': '',
        'url_project': '',
        'url_slides': '',
        'url_source': semantic_url,
        'url_video': '',
        'projects': [],
        'tags': [],
        'categories': []
    }

    if semantic_url:
        frontmatter['links'] = [
            {'name': 'Semantic Scholar', 'url': semantic_url}
        ]

    yaml_frontmatter = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True, sort_keys=False)

    content = f"""---
{yaml_frontmatter}---

## Summary

{synopsis_text if synopsis_text else 'No summary available.'}

*({synopsis_type} summary, v{article.get('llm_synopsis_version', 0)}, {synopsis_date})*

## Citation Information

**Citations:** {article.get('citation_count', 0)} (as of {citation_date})

[View on Semantic Scholar]({semantic_url if semantic_url else '#'})

## Abstract

{article.get('abstract', 'No abstract available.')}
"""

    # Use a safe directory name
    safe_id = paper_id.replace('/', '_').replace(':', '_')[:50] if paper_id else hashlib.md5(article.get('title', '').encode()).hexdigest()[:16]
    output_dir = Path(CONTENT_PUBLICATION_DIR) / safe_id
    output_dir.mkdir(parents=True, exist_ok=True)

    filepath = output_dir / "index.md"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return str(filepath)


def regenerate_all_pages(publications: dict):
    """Regenerate all Hugo pages from existing data"""
    log_info("Regenerating all Hugo pages...")
    pages_generated = 0

    for paper_id, article in publications.get('articles', {}).items():
        try:
            generate_hugo_page(paper_id, article)
            pages_generated += 1
        except Exception as e:
            log_error(f"Failed to generate page for {paper_id}: {e}")

    log_info(f"Generated {pages_generated} Hugo pages")
    return pages_generated


def process_publications(publications: dict, papers: list, dry_run: bool = False) -> dict:
    """Process all publications and update database"""
    current_timestamp = get_current_timestamp()

    new_articles_count = 0
    updated_citations_count = 0
    synopsis_generated_count = 0
    synopsis_regenerated_count = 0
    error_count = 0
    error_details = []

    for paper in papers:
        try:
            paper_id = extract_paper_id(paper)
            if not paper_id:
                log_warning(f"Could not extract paper_id for: {paper.get('title', 'Unknown')}")
                continue

            if paper_id in publications['articles']:
                existing = publications['articles'][paper_id]

                old_count = existing.get('citation_count', 0)
                new_count = paper.get('citationCount', 0) or 0

                if new_count != old_count:
                    existing['citation_count'] = new_count
                    if 'citation_count_history' not in existing:
                        existing['citation_count_history'] = []
                    existing['citation_count_history'].append({
                        'date': current_timestamp.split('T')[0],
                        'count': new_count
                    })
                    updated_citations_count += 1
                    log_info(f"Updated citations for '{paper.get('title', 'Unknown')[:40]}...': {old_count} -> {new_count}")

                existing['last_updated'] = current_timestamp

                # Check if synopsis needs regeneration
                needs_regeneration = (
                    existing.get('force_regenerate', False) or
                    existing.get('llm_synopsis_version', 0) < CURRENT_SYNOPSIS_PROMPT_VERSION
                )

                if needs_regeneration and not existing.get('manual_synopsis'):
                    if not dry_run:
                        log_info(f"Regenerating synopsis for: {paper.get('title', 'Unknown')[:40]}...")
                        try:
                            synopsis = generate_synopsis(paper)
                            if synopsis:
                                existing['llm_synopsis'] = synopsis
                                existing['llm_synopsis_version'] = CURRENT_SYNOPSIS_PROMPT_VERSION
                                existing['llm_synopsis_generated_date'] = current_timestamp
                                existing['force_regenerate'] = False
                                synopsis_regenerated_count += 1
                                time.sleep(CLAUDE_DELAY_SECONDS)
                        except Exception as e:
                            log_error(f"Failed to regenerate synopsis: {e}")

            else:
                # New article
                year = paper.get('year', 0) or 0

                new_article_entry = {
                    'paper_id': paper_id,
                    'title': paper.get('title', 'Unknown Title'),
                    'authors': parse_authors_from_list(paper.get('authors', [])),
                    'year': year,
                    'venue': paper.get('venue', 'Unknown venue') or 'Unknown venue',
                    'abstract': paper.get('abstract', 'No abstract available') or 'No abstract available',
                    'semantic_scholar_url': f"https://www.semanticscholar.org/paper/{paper_id}",
                    'citation_count': paper.get('citationCount', 0) or 0,
                    'citation_count_history': [{
                        'date': current_timestamp.split('T')[0],
                        'count': paper.get('citationCount', 0) or 0
                    }],
                    'llm_synopsis': '',
                    'llm_synopsis_version': 0,
                    'llm_synopsis_generated_date': None,
                    'manual_synopsis': None,
                    'force_regenerate': False,
                    'first_seen': current_timestamp,
                    'last_updated': current_timestamp,
                    'external_ids': paper.get('externalIds', {})
                }

                if not dry_run:
                    log_info(f"Generating synopsis for new article: {paper.get('title', 'Unknown')[:40]}...")
                    try:
                        synopsis = generate_synopsis(paper)
                        if synopsis:
                            new_article_entry['llm_synopsis'] = synopsis
                            new_article_entry['llm_synopsis_version'] = CURRENT_SYNOPSIS_PROMPT_VERSION
                            new_article_entry['llm_synopsis_generated_date'] = current_timestamp
                            synopsis_generated_count += 1
                            time.sleep(CLAUDE_DELAY_SECONDS)
                    except Exception as e:
                        log_error(f"Failed to generate synopsis: {e}")

                publications['articles'][paper_id] = new_article_entry
                new_articles_count += 1
                log_info(f"Added new article: {paper.get('title', 'Unknown')[:50]}...")

        except Exception as e:
            error_count += 1
            title = paper.get('title', 'Unknown')
            error_details.append({
                'article_title': title,
                'error': str(e),
                'timestamp': current_timestamp
            })
            log_error(f"Failed processing '{title}': {e}")
            continue

    return {
        'new_articles': new_articles_count,
        'updated_citations': updated_citations_count,
        'synopsis_generated': synopsis_generated_count,
        'synopsis_regenerated': synopsis_regenerated_count,
        'errors': error_count,
        'error_details': error_details
    }


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Track publications and generate AI synopses'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run without saving changes (test mode)'
    )
    parser.add_argument(
        '--regenerate-pages-only',
        action='store_true',
        help='Only regenerate Hugo pages from existing data'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose output'
    )
    return parser.parse_args()


def main():
    """Main entry point"""
    args = parse_args()
    dry_run = args.dry_run

    start_time = time.time()
    current_timestamp = get_current_timestamp()

    log_info(f"Starting Publications Tracker at {current_timestamp}")
    log_info(f"Data source: Semantic Scholar API")
    log_info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    publications = load_json_file(PUBLICATIONS_JSON)
    if not publications:
        publications = initialize_publications_data()
        log_info("Initialized new publications database")

    run_history = load_json_file(RUN_HISTORY_JSON)
    if not run_history:
        run_history = initialize_run_history()
        log_info("Initialized new run history")

    if args.regenerate_pages_only:
        log_info("Regenerating Hugo pages only (no API fetch)")
        pages = regenerate_all_pages(publications)
        log_info(f"Regenerated {pages} pages")
        return

    stored_version = publications.get('metadata', {}).get('synopsis_prompt_version', 0)
    if stored_version < CURRENT_SYNOPSIS_PROMPT_VERSION:
        log_info(f"Synopsis prompt version bumped: {stored_version} -> {CURRENT_SYNOPSIS_PROMPT_VERSION}")
        log_info("All synopses will be regenerated")

    old_article_count = len(publications.get('articles', {}))

    try:
        # Use stored author ID if available, otherwise discover it
        stored_author_id = publications.get('metadata', {}).get('semantic_scholar_author_id')

        papers, discovered_author_id = fetch_author_publications(stored_author_id)
        log_info(f"Fetched {len(papers)} publications from Semantic Scholar")

        # Store the discovered author ID for future runs
        if discovered_author_id and discovered_author_id != stored_author_id:
            publications['metadata']['semantic_scholar_author_id'] = discovered_author_id
            log_info(f"Stored author ID: {discovered_author_id}")

        results = process_publications(publications, papers, dry_run)

        run_summary = {
            'timestamp': current_timestamp,
            'status': 'success' if results['errors'] == 0 else 'partial_failure',
            'data_source': 'semantic_scholar',
            'new_articles': results['new_articles'],
            'updated_citations': results['updated_citations'],
            'synopsis_generated': results['synopsis_generated'],
            'synopsis_regenerated': results['synopsis_regenerated'],
            'errors': results['errors'],
            'error_details': results['error_details'],
            'dry_run': dry_run,
            'duration_seconds': int(time.time() - start_time)
        }

        if not dry_run:
            try:
                if validate_data(publications, old_article_count):
                    publications['metadata']['last_updated'] = current_timestamp
                    publications['metadata']['total_articles'] = len(publications['articles'])
                    publications['metadata']['synopsis_prompt_version'] = CURRENT_SYNOPSIS_PROMPT_VERSION
                    publications['metadata']['data_source'] = 'semantic_scholar'

                    save_json_file(PUBLICATIONS_JSON, publications)
                    log_info(f"Saved publications data to {PUBLICATIONS_JSON}")

                    run_history['runs'].append(run_summary)
                    save_json_file(RUN_HISTORY_JSON, run_history)
                    log_info(f"Saved run history to {RUN_HISTORY_JSON}")

                    pages_generated = regenerate_all_pages(publications)

                    print(f"\n✓ Run complete!")
                    print(f"  New articles: {results['new_articles']}")
                    print(f"  Updated citations: {results['updated_citations']}")
                    print(f"  Synopses generated: {results['synopsis_generated']}")
                    print(f"  Synopses regenerated: {results['synopsis_regenerated']}")
                    print(f"  Hugo pages generated: {pages_generated}")
                    print(f"  Errors: {results['errors']}")
                    print(f"  Duration: {run_summary['duration_seconds']}s")

            except ValidationError as e:
                print(f"::error::Validation failed: {e}")
                sys.exit(1)
        else:
            print(f"\n✓ DRY RUN complete - no changes saved")
            print(f"  Would have processed: {results['new_articles']} new, {results['updated_citations']} updated")
            print(f"  Errors: {results['errors']}")

        if results['errors'] > 0:
            total = len(publications.get('articles', {})) or 1
            error_rate = results['errors'] / total
            if error_rate > 0.2:
                print(f"::error::High error rate: {results['errors']} errors ({error_rate:.1%})")
                sys.exit(1)

    except Exception as e:
        log_error(f"Fatal error: {e}")

        run_summary = {
            'timestamp': current_timestamp,
            'status': 'failure',
            'data_source': 'semantic_scholar',
            'new_articles': 0,
            'updated_citations': 0,
            'synopsis_generated': 0,
            'synopsis_regenerated': 0,
            'errors': 1,
            'error_details': [{'error': str(e), 'timestamp': current_timestamp}],
            'dry_run': dry_run,
            'duration_seconds': int(time.time() - start_time)
        }

        if not dry_run:
            run_history['runs'].append(run_summary)
            save_json_file(RUN_HISTORY_JSON, run_history)

        sys.exit(1)


if __name__ == '__main__':
    main()
