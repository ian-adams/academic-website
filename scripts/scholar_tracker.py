#!/usr/bin/env python3
"""
Publications Tracker with AI Synopses

Tracks Ian Adams' publications via OpenAlex API, generates AI synopses
for new articles, maintains citation counts, and publishes to Hugo/Wowchemy website.

Uses OpenAlex API (free, open, comprehensive) via pyalex library.
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
import pyalex
import yaml
from pyalex import Works, Authors

# Configuration Constants
AUTHOR_NAME = "Ian T. Adams"
OPENALEX_AUTHOR_ID = "A5052998143"  # Ian's OpenAlex Author ID
MIN_PUBLICATION_YEAR = 2017  # Filter out earlier publications (different author with same name)

# Set email for polite pool (higher rate limits)
POLITE_POOL_EMAIL = "github-actions@ianadamsresearch.com"

CURRENT_SYNOPSIS_PROMPT_VERSION = 1
CLAUDE_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 1024

# Rate limiting
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
            "openalex_author_id": OPENALEX_AUTHOR_ID,
            "data_source": "openalex"
        },
        "articles": {}
    }


def initialize_run_history() -> dict:
    """Initialize empty run history structure"""
    return {"runs": []}


def fetch_author_publications() -> list:
    """Fetch all publications for the author from OpenAlex"""
    log_info(f"Fetching publications for OpenAlex author ID: {OPENALEX_AUTHOR_ID}")

    # Configure pyalex for polite pool
    pyalex.config.email = POLITE_POOL_EMAIL

    all_works = []

    try:
        # Use pagination to get all works
        # Filter by author ID and paginate through results
        pager = Works().filter(authorships={"author": {"id": OPENALEX_AUTHOR_ID}}).paginate(per_page=100)

        page_num = 0
        for page in pager:
            page_num += 1
            all_works.extend(page)
            log_info(f"Fetched page {page_num}, total works so far: {len(all_works)}")

            # Safety limit
            if len(all_works) > 500:
                log_warning("Reached 500 works limit, stopping pagination")
                break

        # Filter out publications before MIN_PUBLICATION_YEAR (different author with same name)
        filtered_works = [
            w for w in all_works
            if (w.get('publication_year') or 0) >= MIN_PUBLICATION_YEAR
        ]
        removed_count = len(all_works) - len(filtered_works)
        if removed_count > 0:
            log_info(f"Filtered out {removed_count} publications before {MIN_PUBLICATION_YEAR}")

        log_info(f"Total publications after filtering: {len(filtered_works)}")
        return filtered_works

    except Exception as e:
        log_error(f"Failed to fetch publications: {e}")
        raise


def extract_work_id(work: dict) -> str:
    """Extract unique ID from work data"""
    # Prefer OpenAlex ID
    openalex_id = work.get('id', '')
    if openalex_id:
        # Extract just the ID part (e.g., "W1234567" from "https://openalex.org/W1234567")
        return openalex_id.split('/')[-1] if '/' in openalex_id else openalex_id

    # Fallback to DOI
    doi = work.get('doi', '')
    if doi:
        return f"doi_{doi.replace('https://doi.org/', '').replace('/', '_')}"

    # Fallback to title hash
    title = work.get('title', '') or work.get('display_name', '')
    if title:
        return hashlib.md5(title.encode()).hexdigest()[:16]

    # Last resort
    return hashlib.md5(str(time.time()).encode()).hexdigest()[:16]


def parse_authors_from_work(work: dict) -> list:
    """Parse authors from OpenAlex work authorships"""
    authorships = work.get('authorships', [])
    if not authorships:
        return []

    authors = []
    for authorship in authorships:
        author = authorship.get('author', {})
        name = author.get('display_name', '')
        if name:
            authors.append(name)

    return authors


def get_venue_from_work(work: dict) -> str:
    """Extract venue/journal name from work"""
    primary_location = work.get('primary_location', {})
    if primary_location:
        source = primary_location.get('source', {})
        if source:
            return source.get('display_name', 'Unknown venue') or 'Unknown venue'

    # Fallback to host venue
    host_venue = work.get('host_venue', {})
    if host_venue:
        return host_venue.get('display_name', 'Unknown venue') or 'Unknown venue'

    return 'Unknown venue'


def get_abstract_from_work(work: dict) -> str:
    """Extract abstract from work (pyalex auto-reconstructs from inverted index)"""
    # pyalex automatically converts abstract_inverted_index to plaintext
    abstract = work.get('abstract')
    if abstract:
        return abstract

    # Check for abstract_inverted_index and reconstruct if needed
    abstract_inv = work.get('abstract_inverted_index')
    if abstract_inv:
        # Reconstruct from inverted index
        try:
            word_positions = []
            for word, positions in abstract_inv.items():
                for pos in positions:
                    word_positions.append((pos, word))
            word_positions.sort(key=lambda x: x[0])
            return ' '.join(word for _, word in word_positions)
        except Exception:
            pass

    return 'No abstract available'


def generate_synopsis(work: dict, max_retries: int = 2) -> str:
    """Generate AI synopsis for a work using Claude API"""
    title = work.get('title') or work.get('display_name', 'Unknown')
    authors = ', '.join(parse_authors_from_work(work))
    year = work.get('publication_year', 'Unknown')
    venue = get_venue_from_work(work)
    abstract = get_abstract_from_work(work)

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
    required_fields = ['work_id', 'title', 'authors', 'year', 'citation_count', 'first_seen']

    for work_id, article in publications['articles'].items():
        for field in required_fields:
            if field not in article:
                raise ValidationError(f"Missing field '{field}' in article {work_id}")

        if not isinstance(article['authors'], list):
            raise ValidationError(f"'authors' must be list in article {work_id}")
        if not isinstance(article['citation_count'], int):
            raise ValidationError(f"'citation_count' must be int in article {work_id}")

    # Check no articles lost (allow small decrease due to data updates)
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


def generate_hugo_page(work_id: str, article: dict):
    """Generate Hugo/Wowchemy publication page for an article"""
    synopsis_text = article.get('manual_synopsis') or article.get('llm_synopsis', '')
    synopsis_type = "Manual" if article.get('manual_synopsis') else "AI-generated"

    synopsis_date = format_date(article.get('llm_synopsis_generated_date', article.get('first_seen')))
    citation_date = format_date(article.get('last_updated'))

    year = article.get('year', 2024)
    if not year or year == 0:
        year = 2024

    # Build OpenAlex URL
    openalex_url = f"https://openalex.org/{work_id}" if work_id else ""
    doi_url = article.get('doi', '')

    # Determine publication type: CrimRxiv = preprint (3), otherwise journal article (2)
    venue = article.get('venue', '')
    is_preprint = 'crimrxiv' in venue.lower() if venue else False
    publication_type = ['3'] if is_preprint else ['2']

    frontmatter = {
        'title': article.get('title', 'Unknown Title'),
        'authors': article.get('authors', []),
        'date': f"{year}-01-01",
        'publishDate': f"{year}-01-01",
        'publication_types': publication_type,
        'publication': venue,
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
        'url_source': doi_url or openalex_url,
        'url_video': '',
        'projects': [],
        'tags': [],
        'categories': []
    }

    # Add links
    links = []
    if openalex_url:
        links.append({'name': 'OpenAlex', 'url': openalex_url})
    if doi_url:
        links.append({'name': 'DOI', 'url': doi_url})
    if links:
        frontmatter['links'] = links

    yaml_frontmatter = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True, sort_keys=False)

    # Determine the best URL for the "View" link
    view_url = doi_url or openalex_url or '#'

    content = f"""---
{yaml_frontmatter}---

## Summary

{synopsis_text if synopsis_text else 'No summary available.'}

*({synopsis_type} summary, v{article.get('llm_synopsis_version', 0)}, {synopsis_date})*

## Citation Information

**Citations:** {article.get('citation_count', 0)} (as of {citation_date})

[View Publication]({view_url})
"""

    # Use a safe directory name
    safe_id = work_id.replace('/', '_').replace(':', '_')[:50] if work_id else hashlib.md5(article.get('title', '').encode()).hexdigest()[:16]
    output_dir = Path(CONTENT_PUBLICATION_DIR) / safe_id
    output_dir.mkdir(parents=True, exist_ok=True)

    filepath = output_dir / "index.md"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return str(filepath)


def delete_hugo_page(work_id: str):
    """Delete Hugo page directory for a removed publication"""
    import shutil
    safe_id = work_id.replace('/', '_').replace(':', '_')[:50] if work_id else None
    if not safe_id:
        return False

    output_dir = Path(CONTENT_PUBLICATION_DIR) / safe_id
    if output_dir.exists():
        shutil.rmtree(output_dir)
        log_info(f"Deleted Hugo page directory: {output_dir}")
        return True
    return False


def cleanup_orphaned_hugo_pages(publications: dict):
    """Remove Hugo page directories that don't correspond to valid publications"""
    import shutil

    content_dir = Path(CONTENT_PUBLICATION_DIR)
    if not content_dir.exists():
        return 0

    # Build set of valid directory names from current publications
    valid_dirs = set()
    for work_id, article in publications.get('articles', {}).items():
        safe_id = work_id.replace('/', '_').replace(':', '_')[:50] if work_id else None
        if safe_id:
            valid_dirs.add(safe_id)

    # Scan existing directories and remove orphans
    removed_count = 0
    for item in content_dir.iterdir():
        if item.is_dir() and item.name not in valid_dirs and item.name != '_index.md':
            shutil.rmtree(item)
            log_info(f"Removed orphaned Hugo page: {item.name}")
            removed_count += 1

    if removed_count > 0:
        log_info(f"Cleaned up {removed_count} orphaned Hugo page directories")

    return removed_count


def regenerate_all_pages(publications: dict):
    """Regenerate all Hugo pages from existing data"""
    log_info("Regenerating all Hugo pages...")

    # First, clean up any orphaned page directories
    cleanup_orphaned_hugo_pages(publications)

    pages_generated = 0
    for work_id, article in publications.get('articles', {}).items():
        try:
            generate_hugo_page(work_id, article)
            pages_generated += 1
        except Exception as e:
            log_error(f"Failed to generate page for {work_id}: {e}")

    log_info(f"Generated {pages_generated} Hugo pages")
    return pages_generated


def process_publications(publications: dict, works: list, dry_run: bool = False) -> dict:
    """Process all publications and update database"""
    current_timestamp = get_current_timestamp()

    new_articles_count = 0
    updated_citations_count = 0
    synopsis_generated_count = 0
    synopsis_regenerated_count = 0
    error_count = 0
    error_details = []
    skipped_old_count = 0

    # First, clean up any existing pre-2017 entries in the database
    articles_to_remove = []
    for work_id, article in publications.get('articles', {}).items():
        year = article.get('year', 0) or 0
        if year < MIN_PUBLICATION_YEAR and year > 0:
            articles_to_remove.append(work_id)
            log_info(f"Removing pre-{MIN_PUBLICATION_YEAR} publication: {article.get('title', 'Unknown')[:50]}...")

    for work_id in articles_to_remove:
        del publications['articles'][work_id]
        # Also delete the Hugo page directory
        delete_hugo_page(work_id)

    if articles_to_remove:
        log_info(f"Removed {len(articles_to_remove)} pre-{MIN_PUBLICATION_YEAR} publications from database and Hugo pages")

    for work in works:
        try:
            work_id = extract_work_id(work)
            if not work_id:
                log_warning(f"Could not extract work_id for: {work.get('title', 'Unknown')}")
                continue

            # Skip pre-2017 publications (different author with same name)
            year = work.get('publication_year', 0) or 0
            if year < MIN_PUBLICATION_YEAR and year > 0:
                skipped_old_count += 1
                continue

            title = work.get('title') or work.get('display_name', 'Unknown Title')

            if work_id in publications['articles']:
                existing = publications['articles'][work_id]

                old_count = existing.get('citation_count', 0)
                new_count = work.get('cited_by_count', 0) or 0

                if new_count != old_count:
                    existing['citation_count'] = new_count
                    if 'citation_count_history' not in existing:
                        existing['citation_count_history'] = []
                    existing['citation_count_history'].append({
                        'date': current_timestamp.split('T')[0],
                        'count': new_count
                    })
                    updated_citations_count += 1
                    log_info(f"Updated citations for '{title[:40]}...': {old_count} -> {new_count}")

                existing['last_updated'] = current_timestamp

                # Check if synopsis needs regeneration
                needs_regeneration = (
                    existing.get('force_regenerate', False) or
                    existing.get('llm_synopsis_version', 0) < CURRENT_SYNOPSIS_PROMPT_VERSION
                )

                if needs_regeneration and not existing.get('manual_synopsis'):
                    if not dry_run:
                        log_info(f"Regenerating synopsis for: {title[:40]}...")
                        try:
                            synopsis = generate_synopsis(work)
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
                year = work.get('publication_year', 0) or 0
                doi = work.get('doi', '')

                new_article_entry = {
                    'work_id': work_id,
                    'title': title,
                    'authors': parse_authors_from_work(work),
                    'year': year,
                    'venue': get_venue_from_work(work),
                    'abstract': get_abstract_from_work(work),
                    'doi': doi,
                    'openalex_url': f"https://openalex.org/{work_id}",
                    'citation_count': work.get('cited_by_count', 0) or 0,
                    'citation_count_history': [{
                        'date': current_timestamp.split('T')[0],
                        'count': work.get('cited_by_count', 0) or 0
                    }],
                    'llm_synopsis': '',
                    'llm_synopsis_version': 0,
                    'llm_synopsis_generated_date': None,
                    'manual_synopsis': None,
                    'force_regenerate': False,
                    'first_seen': current_timestamp,
                    'last_updated': current_timestamp,
                    'open_access': work.get('open_access', {}).get('is_oa', False),
                    'type': work.get('type', 'unknown')
                }

                if not dry_run:
                    log_info(f"Generating synopsis for new article: {title[:40]}...")
                    try:
                        synopsis = generate_synopsis(work)
                        if synopsis:
                            new_article_entry['llm_synopsis'] = synopsis
                            new_article_entry['llm_synopsis_version'] = CURRENT_SYNOPSIS_PROMPT_VERSION
                            new_article_entry['llm_synopsis_generated_date'] = current_timestamp
                            synopsis_generated_count += 1
                            time.sleep(CLAUDE_DELAY_SECONDS)
                    except Exception as e:
                        log_error(f"Failed to generate synopsis: {e}")

                publications['articles'][work_id] = new_article_entry
                new_articles_count += 1
                log_info(f"Added new article: {title[:50]}...")

        except Exception as e:
            error_count += 1
            title = work.get('title') or work.get('display_name', 'Unknown')
            error_details.append({
                'article_title': title,
                'error': str(e),
                'timestamp': current_timestamp
            })
            log_error(f"Failed processing '{title}': {e}")
            continue

    if skipped_old_count > 0:
        log_info(f"Skipped {skipped_old_count} pre-{MIN_PUBLICATION_YEAR} publications during processing")

    return {
        'new_articles': new_articles_count,
        'updated_citations': updated_citations_count,
        'synopsis_generated': synopsis_generated_count,
        'synopsis_regenerated': synopsis_regenerated_count,
        'skipped_old': skipped_old_count,
        'removed_old': len(articles_to_remove),
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
    log_info(f"Data source: OpenAlex API")
    log_info(f"Author ID: {OPENALEX_AUTHOR_ID}")
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
        works = fetch_author_publications()
        log_info(f"Fetched {len(works)} publications from OpenAlex")

        results = process_publications(publications, works, dry_run)

        run_summary = {
            'timestamp': current_timestamp,
            'status': 'success' if results['errors'] == 0 else 'partial_failure',
            'data_source': 'openalex',
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
                    publications['metadata']['data_source'] = 'openalex'
                    publications['metadata']['openalex_author_id'] = OPENALEX_AUTHOR_ID

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
            'data_source': 'openalex',
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
