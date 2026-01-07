#!/usr/bin/env python3
"""
Google Scholar Publications Tracker with AI Synopses

Tracks Ian Adams' Google Scholar publications, generates AI synopses for new articles,
maintains citation counts, and publishes to Hugo/Wowchemy website.
"""

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import anthropic
import yaml
from scholarly import scholarly
from slugify import slugify

# Configuration Constants
AUTHOR_NAME = "Ian Adams"
AUTHOR_SCHOLAR_ID = "g9lY5RUAAAAJ"
CURRENT_SYNOPSIS_PROMPT_VERSION = 1
CLAUDE_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 1024

# Rate limiting
SCHOLAR_DELAY_SECONDS = 5
CLAUDE_DELAY_SECONDS = 2

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
            "author_scholar_id": AUTHOR_SCHOLAR_ID
        },
        "articles": {}
    }


def initialize_run_history() -> dict:
    """Initialize empty run history structure"""
    return {"runs": []}


def fetch_author_publications() -> list:
    """Fetch all publications for the author from Google Scholar"""
    log_info(f"Fetching publications for author ID: {AUTHOR_SCHOLAR_ID}")

    try:
        # Get author by ID
        author = scholarly.search_author_id(AUTHOR_SCHOLAR_ID)
        author = scholarly.fill(author)

        log_info(f"Found author: {author.get('name', 'Unknown')}")
        log_info(f"Total publications listed: {len(author.get('publications', []))}")

        publications = []
        for i, pub in enumerate(author.get('publications', [])):
            try:
                log_info(f"Fetching publication {i+1}/{len(author['publications'])}: {pub.get('bib', {}).get('title', 'Unknown')[:50]}...")

                # Fill in complete publication details
                filled_pub = scholarly.fill(pub)
                publications.append(filled_pub)

                # Rate limiting - be respectful to Google Scholar
                time.sleep(SCHOLAR_DELAY_SECONDS)

            except Exception as e:
                log_error(f"Failed to fetch publication details: {e}")
                # Still add the partial publication data
                publications.append(pub)
                continue

        return publications

    except Exception as e:
        log_error(f"Failed to fetch author: {e}")
        raise


def extract_scholar_id(article: dict) -> str:
    """Extract unique scholar ID from article data"""
    # Try to get author_pub_id first
    author_pub_id = article.get('author_pub_id', '')
    if author_pub_id and ':' in author_pub_id:
        return author_pub_id.split(':')[-1]
    elif author_pub_id:
        return author_pub_id

    # Fallback: create ID from title hash
    title = article.get('bib', {}).get('title', '')
    if title:
        return hashlib.md5(title.encode()).hexdigest()[:16]

    # Last resort: random hash
    return hashlib.md5(str(time.time()).encode()).hexdigest()[:16]


def parse_authors(author_string: str) -> list:
    """Parse author string into list of authors"""
    if not author_string:
        return []

    # Handle "and" separated authors
    authors = []
    for part in author_string.split(' and '):
        # Clean up whitespace
        author = part.strip()
        if author:
            authors.append(author)

    return authors


def generate_synopsis(article: dict, max_retries: int = 2) -> str:
    """Generate AI synopsis for an article using Claude API"""
    bib = article.get('bib', {})

    title = bib.get('title', 'Unknown')
    authors = ', '.join(parse_authors(bib.get('author', '')))
    year = bib.get('pub_year', 'Unknown')
    venue = bib.get('venue', bib.get('journal', bib.get('conference', 'Unknown venue')))
    abstract = bib.get('abstract', 'No abstract available')

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
                wait_time = 2 ** attempt  # exponential backoff: 1s, 2s
                log_warning(f"Claude API attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
            else:
                log_error(f"Claude API failed after {max_retries + 1} attempts: {e}")
                raise


def validate_data(publications: dict, old_count: int) -> bool:
    """Validate publications data before saving"""
    required_fields = ['scholar_id', 'title', 'authors', 'year',
                       'citation_count', 'first_seen']

    for scholar_id, article in publications['articles'].items():
        for field in required_fields:
            if field not in article:
                raise ValidationError(f"Missing field '{field}' in article {scholar_id}")

        # Validate data types
        if not isinstance(article['authors'], list):
            raise ValidationError(f"'authors' must be list in article {scholar_id}")
        if not isinstance(article['citation_count'], int):
            raise ValidationError(f"'citation_count' must be int in article {scholar_id}")

    # Check no articles lost
    new_count = len(publications['articles'])
    if new_count < old_count:
        raise ValidationError(f"Article count decreased: {old_count} -> {new_count}")

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


def generate_hugo_page(scholar_id: str, article: dict):
    """Generate Hugo/Wowchemy publication page for an article"""
    # Determine which synopsis to use
    synopsis_text = article.get('manual_synopsis') or article.get('llm_synopsis', '')
    synopsis_type = "Manual" if article.get('manual_synopsis') else "AI-generated"

    # Format dates
    synopsis_date = format_date(article.get('llm_synopsis_generated_date', article.get('first_seen')))
    citation_date = format_date(article.get('last_updated'))

    # Get year with fallback
    year = article.get('year', 2024)
    if not year or year == 0:
        year = 2024

    # Generate frontmatter
    frontmatter = {
        'title': article.get('title', 'Unknown Title'),
        'authors': article.get('authors', []),
        'date': f"{year}-01-01",
        'publishDate': f"{year}-01-01",
        'publication_types': ['2'],  # 2 = Journal article
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
        'url_source': article.get('google_scholar_url', ''),
        'url_video': '',
        'projects': [],
        'tags': [],
        'categories': []
    }

    # Add links if we have a Google Scholar URL
    if article.get('google_scholar_url'):
        frontmatter['links'] = [
            {'name': 'Google Scholar', 'url': article['google_scholar_url']}
        ]

    # Build markdown content
    yaml_frontmatter = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True, sort_keys=False)

    content = f"""---
{yaml_frontmatter}---

## Summary

{synopsis_text if synopsis_text else 'No summary available.'}

*({synopsis_type} summary, v{article.get('llm_synopsis_version', 0)}, {synopsis_date})*

## Citation Information

**Citations:** {article.get('citation_count', 0)} (as of {citation_date})

[View on Google Scholar]({article.get('google_scholar_url', '#')})

## Abstract

{article.get('abstract', 'No abstract available.')}
"""

    # Write to file
    output_dir = Path(CONTENT_PUBLICATION_DIR) / scholar_id
    output_dir.mkdir(parents=True, exist_ok=True)

    filepath = output_dir / "index.md"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return str(filepath)


def regenerate_all_pages(publications: dict):
    """Regenerate all Hugo pages from existing data"""
    log_info("Regenerating all Hugo pages...")
    pages_generated = 0

    for scholar_id, article in publications.get('articles', {}).items():
        try:
            generate_hugo_page(scholar_id, article)
            pages_generated += 1
        except Exception as e:
            log_error(f"Failed to generate page for {scholar_id}: {e}")

    log_info(f"Generated {pages_generated} Hugo pages")
    return pages_generated


def process_publications(publications: dict, scholar_results: list, dry_run: bool = False) -> dict:
    """Process all publications from Scholar and update database"""
    current_timestamp = get_current_timestamp()

    # Counters
    new_articles_count = 0
    updated_citations_count = 0
    synopsis_generated_count = 0
    synopsis_regenerated_count = 0
    error_count = 0
    error_details = []

    for article in scholar_results:
        try:
            bib = article.get('bib', {})
            scholar_id = extract_scholar_id(article)

            if not scholar_id:
                log_warning(f"Could not extract scholar_id for article: {bib.get('title', 'Unknown')}")
                continue

            # Check if exists in our database
            if scholar_id in publications['articles']:
                existing = publications['articles'][scholar_id]

                # Update citation count
                old_count = existing.get('citation_count', 0)
                new_count = article.get('num_citations', 0) or 0

                if new_count != old_count:
                    existing['citation_count'] = new_count
                    if 'citation_count_history' not in existing:
                        existing['citation_count_history'] = []
                    existing['citation_count_history'].append({
                        'date': current_timestamp.split('T')[0],
                        'count': new_count
                    })
                    updated_citations_count += 1
                    log_info(f"Updated citations for '{bib.get('title', 'Unknown')[:40]}...': {old_count} -> {new_count}")

                existing['last_updated'] = current_timestamp

                # Check if synopsis needs regeneration
                needs_regeneration = (
                    existing.get('force_regenerate', False) == True or
                    existing.get('llm_synopsis_version', 0) < CURRENT_SYNOPSIS_PROMPT_VERSION
                )

                if needs_regeneration and not existing.get('manual_synopsis'):
                    if not dry_run:
                        log_info(f"Regenerating synopsis for: {bib.get('title', 'Unknown')[:40]}...")
                        try:
                            synopsis = generate_synopsis(article)
                            if synopsis:
                                existing['llm_synopsis'] = synopsis
                                existing['llm_synopsis_version'] = CURRENT_SYNOPSIS_PROMPT_VERSION
                                existing['llm_synopsis_generated_date'] = current_timestamp
                                existing['force_regenerate'] = False
                                synopsis_regenerated_count += 1

                                # Rate limiting for Claude API
                                time.sleep(CLAUDE_DELAY_SECONDS)
                        except Exception as e:
                            log_error(f"Failed to regenerate synopsis: {e}")

            else:
                # New article - create complete entry
                venue = bib.get('venue', bib.get('journal', bib.get('conference', 'Unknown venue')))
                year_str = bib.get('pub_year', '0')
                try:
                    year = int(year_str) if year_str else 0
                except (ValueError, TypeError):
                    year = 0

                new_article_entry = {
                    'scholar_id': scholar_id,
                    'title': bib.get('title', 'Unknown Title'),
                    'authors': parse_authors(bib.get('author', '')),
                    'year': year,
                    'venue': venue,
                    'abstract': bib.get('abstract', 'No abstract available'),
                    'google_scholar_url': article.get('pub_url', ''),
                    'citation_count': article.get('num_citations', 0) or 0,
                    'citation_count_history': [{
                        'date': current_timestamp.split('T')[0],
                        'count': article.get('num_citations', 0) or 0
                    }],
                    'llm_synopsis': '',
                    'llm_synopsis_version': 0,
                    'llm_synopsis_generated_date': None,
                    'manual_synopsis': None,
                    'force_regenerate': False,
                    'first_seen': current_timestamp,
                    'last_updated': current_timestamp
                }

                # Generate synopsis for new article
                if not dry_run:
                    log_info(f"Generating synopsis for new article: {bib.get('title', 'Unknown')[:40]}...")
                    try:
                        synopsis = generate_synopsis(article)
                        if synopsis:
                            new_article_entry['llm_synopsis'] = synopsis
                            new_article_entry['llm_synopsis_version'] = CURRENT_SYNOPSIS_PROMPT_VERSION
                            new_article_entry['llm_synopsis_generated_date'] = current_timestamp
                            synopsis_generated_count += 1

                            # Rate limiting for Claude API
                            time.sleep(CLAUDE_DELAY_SECONDS)
                    except Exception as e:
                        log_error(f"Failed to generate synopsis: {e}")

                publications['articles'][scholar_id] = new_article_entry
                new_articles_count += 1
                log_info(f"Added new article: {bib.get('title', 'Unknown')[:50]}...")

        except Exception as e:
            error_count += 1
            title = article.get('bib', {}).get('title', 'Unknown')
            error_details.append({
                'article_title': title,
                'error': str(e),
                'timestamp': current_timestamp
            })
            log_error(f"Failed processing '{title}': {e}")
            continue  # Don't let one failure stop the whole run

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
        description='Track Google Scholar publications and generate AI synopses'
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

    log_info(f"Starting Google Scholar tracker at {current_timestamp}")
    log_info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    # Load existing data
    publications = load_json_file(PUBLICATIONS_JSON)
    if not publications:
        publications = initialize_publications_data()
        log_info("Initialized new publications database")

    run_history = load_json_file(RUN_HISTORY_JSON)
    if not run_history:
        run_history = initialize_run_history()
        log_info("Initialized new run history")

    # Handle regenerate-pages-only mode
    if args.regenerate_pages_only:
        log_info("Regenerating Hugo pages only (no Scholar fetch)")
        pages = regenerate_all_pages(publications)
        log_info(f"Regenerated {pages} pages")
        return

    # Check for prompt version bump
    stored_version = publications.get('metadata', {}).get('synopsis_prompt_version', 0)
    if stored_version < CURRENT_SYNOPSIS_PROMPT_VERSION:
        log_info(f"Synopsis prompt version bumped: {stored_version} -> {CURRENT_SYNOPSIS_PROMPT_VERSION}")
        log_info("All synopses will be regenerated")

    old_article_count = len(publications.get('articles', {}))

    try:
        # Fetch from Google Scholar
        scholar_results = fetch_author_publications()
        log_info(f"Fetched {len(scholar_results)} publications from Google Scholar")

        # Process publications
        results = process_publications(publications, scholar_results, dry_run)

        # Create run summary
        run_summary = {
            'timestamp': current_timestamp,
            'status': 'success' if results['errors'] == 0 else 'partial_failure',
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
                # Validate before saving
                if validate_data(publications, old_article_count):
                    # Update metadata
                    publications['metadata']['last_updated'] = current_timestamp
                    publications['metadata']['total_articles'] = len(publications['articles'])
                    publications['metadata']['synopsis_prompt_version'] = CURRENT_SYNOPSIS_PROMPT_VERSION

                    # Save JSON files
                    save_json_file(PUBLICATIONS_JSON, publications)
                    log_info(f"Saved publications data to {PUBLICATIONS_JSON}")

                    run_history['runs'].append(run_summary)
                    save_json_file(RUN_HISTORY_JSON, run_history)
                    log_info(f"Saved run history to {RUN_HISTORY_JSON}")

                    # Generate all Hugo pages
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

        # Error notification for high error rates
        if results['errors'] > 0:
            total = len(publications.get('articles', {})) or 1
            error_rate = results['errors'] / total
            if error_rate > 0.2:  # >20% error rate
                print(f"::error::High error rate: {results['errors']} errors ({error_rate:.1%})")
                sys.exit(1)

    except Exception as e:
        log_error(f"Fatal error: {e}")

        # Save error to run history
        run_summary = {
            'timestamp': current_timestamp,
            'status': 'failure',
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
