#!/usr/bin/env python3
"""
Update per-publication citation counts using OpenAlex (primary) and Google Scholar (fallback).

- Scans src/content/publications/W*.md for OpenAlex IDs
- Batch-fetches cited_by_count from OpenAlex API (no auth needed)
- Falls back to Google Scholar for pubs OpenAlex missed or returned 0 for
- Updates **Citations:** lines in markdown files
"""

import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent
PUBLICATIONS_DIR = SCRIPT_DIR.parent / "src" / "content" / "publications"
OPENALEX_API = "https://api.openalex.org/works"
OPENALEX_BATCH_SIZE = 50  # max IDs per API call
CITATION_PATTERN = re.compile(r"\*\*Citations:\*\*\s*\d+.*")
SCHOLAR_ID = "g9lY5RUAAAAJ"


def collect_publication_files():
    """Find all W*.md files and extract OpenAlex IDs."""
    pubs = {}
    for path in sorted(PUBLICATIONS_DIR.glob("W*.md")):
        oa_id = path.stem  # e.g. "W2774954674"
        pubs[oa_id] = path
    return pubs


def fetch_openalex_citations(oa_ids):
    """Batch-fetch citation counts from OpenAlex API."""
    counts = {}
    batches = [oa_ids[i:i + OPENALEX_BATCH_SIZE] for i in range(0, len(oa_ids), OPENALEX_BATCH_SIZE)]

    for batch_num, batch in enumerate(batches, 1):
        filter_ids = "|".join(f"https://openalex.org/{oid}" for oid in batch)
        params = {
            "filter": f"openalex_id:{filter_ids}",
            "select": "id,cited_by_count",
            "per_page": 200,
            "mailto": "ian.adams@sc.edu",
        }
        print(f"  OpenAlex batch {batch_num}/{len(batches)} ({len(batch)} IDs)...")

        try:
            resp = requests.get(OPENALEX_API, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            for work in data.get("results", []):
                # Extract ID like "W2774954674" from "https://openalex.org/W2774954674"
                full_id = work.get("id", "")
                short_id = full_id.replace("https://openalex.org/", "")
                cited = work.get("cited_by_count", 0)
                counts[short_id] = cited

        except Exception as e:
            print(f"    WARNING: OpenAlex batch {batch_num} failed: {e}")

        # Be polite to the API
        if batch_num < len(batches):
            time.sleep(1)

    return counts


def normalize_title(title):
    """Normalize a title for fuzzy matching: lowercase, strip punctuation, collapse whitespace."""
    title = title.lower()
    # Remove accents
    title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    # Strip non-alphanumeric (keep spaces)
    title = re.sub(r"[^a-z0-9\s]", "", title)
    # Collapse whitespace
    title = re.sub(r"\s+", " ", title).strip()
    return title


def read_title_from_file(path):
    """Extract the title from a publication markdown frontmatter."""
    text = path.read_text(encoding="utf-8")
    match = re.search(r"^title:\s*['\"]?(.+?)['\"]?\s*$", text, re.MULTILINE)
    if match:
        return match.group(1).strip("'\"")
    return None


def fetch_scholar_citations(pub_files, openalex_counts):
    """Fallback: fetch citation counts from Google Scholar for pubs with 0 or missing OpenAlex counts."""
    try:
        from scholarly import scholarly, ProxyGenerator
    except ImportError:
        print("  scholarly not installed, skipping Scholar fallback")
        return {}

    # Identify which pubs need Scholar lookup
    needs_scholar = {}
    for oa_id, path in pub_files.items():
        oa_count = openalex_counts.get(oa_id, 0)
        if oa_count == 0:
            title = read_title_from_file(path)
            if title:
                needs_scholar[normalize_title(title)] = oa_id

    if not needs_scholar:
        print("  No publications need Scholar fallback")
        return {}

    print(f"  Attempting Scholar fallback for {len(needs_scholar)} publications...")

    scholar_counts = {}
    try:
        # Set up proxy to avoid blocking
        try:
            pg = ProxyGenerator()
            success = pg.FreeProxies()
            if success:
                scholarly.use_proxy(pg)
                print("    Proxy configured")
        except Exception as e:
            print(f"    Proxy setup failed ({e}), trying without proxy...")

        author = scholarly.search_author_id(SCHOLAR_ID)
        author = scholarly.fill(author, sections=["basics", "publications"])

        for pub in author.get("publications", []):
            pub_title = normalize_title(pub.get("bib", {}).get("title", ""))
            if pub_title in needs_scholar:
                oa_id = needs_scholar[pub_title]
                cited = pub.get("num_citations", 0)
                if cited > 0:
                    scholar_counts[oa_id] = cited
                    print(f"    Scholar match: {oa_id} -> {cited} citations")

    except Exception as e:
        print(f"    Scholar fallback failed: {e}")

    return scholar_counts


def update_citation_lines(pub_files, citation_counts):
    """Update **Citations:** lines in publication files where count changed."""
    now = datetime.now(timezone.utc)
    month_year = now.strftime("%B %Y")
    updated = 0
    skipped = 0

    for oa_id, path in pub_files.items():
        new_count = citation_counts.get(oa_id)
        if new_count is None:
            continue

        text = path.read_text(encoding="utf-8")

        # Check if there's a citation line to update
        match = CITATION_PATTERN.search(text)
        if not match:
            continue

        old_line = match.group(0)
        new_line = f"**Citations:** {new_count} (as of {month_year})"

        if old_line == new_line:
            skipped += 1
            continue

        new_text = text.replace(old_line, new_line, 1)
        path.write_text(new_text, encoding="utf-8")
        updated += 1
        print(f"  Updated {oa_id}: {old_line} -> {new_line}")

    return updated, skipped


def main():
    print("=" * 60)
    print("Per-Publication Citation Update")
    print("=" * 60)

    # Step 1: Collect publication files
    pub_files = collect_publication_files()
    print(f"\nFound {len(pub_files)} publication files")

    if not pub_files:
        print("No W*.md files found, exiting")
        return

    # Step 2: OpenAlex batch fetch
    print("\nStep 1: Fetching citations from OpenAlex...")
    oa_ids = list(pub_files.keys())
    openalex_counts = fetch_openalex_citations(oa_ids)
    oa_found = sum(1 for c in openalex_counts.values() if c > 0)
    print(f"  OpenAlex returned counts for {len(openalex_counts)} works ({oa_found} with citations > 0)")

    # Step 3: Scholar fallback for pubs OpenAlex missed or returned 0
    print("\nStep 2: Google Scholar fallback...")
    scholar_counts = fetch_scholar_citations(pub_files, openalex_counts)

    # Step 4: Merge — take the higher count from either source
    merged = dict(openalex_counts)
    for oa_id, count in scholar_counts.items():
        if count > merged.get(oa_id, 0):
            merged[oa_id] = count
            print(f"  Scholar override: {oa_id} = {count} (was {openalex_counts.get(oa_id, 0)} from OpenAlex)")

    # Step 5: Update files
    print(f"\nStep 3: Updating publication files...")
    updated, skipped = update_citation_lines(pub_files, merged)

    # Summary
    print(f"\n{'=' * 60}")
    print(f"Done! Updated: {updated}, Unchanged: {skipped}, "
          f"No data: {len(pub_files) - updated - skipped}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
