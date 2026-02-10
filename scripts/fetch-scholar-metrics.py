#!/usr/bin/env python3
"""
Fetch Google Scholar metrics for Ian T. Adams
Saves h-index, i10-index, and total citations to a JSON file

Strategy:
  1. Try direct Scholar fetch (no proxy) — works when IP isn't blocked
  2. If blocked, retry with proxy (FreeProxies or ScraperAPI)
  3. If Scholar is completely unavailable, fall back to OpenAlex for total citations
     and preserve existing h-index/i10-index

Preserves existing data if all sources fail (doesn't overwrite good data with errors).
"""

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from scholarly import scholarly, ProxyGenerator
except ImportError:
    print("Please install scholarly: pip install scholarly")
    exit(1)

try:
    import requests
except ImportError:
    requests = None

SCHOLAR_ID = "g9lY5RUAAAAJ"
SCRIPT_DIR = Path(__file__).parent
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "scholar-metrics.json"
PUBLICATIONS_DIR = SCRIPT_DIR.parent / "src" / "content" / "publications"
MAX_RETRIES = 2
RETRY_DELAY = 5  # seconds


def load_existing_metrics():
    """Load existing metrics file if it exists."""
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return None


def try_setup_proxy():
    """Attempt to set up a proxy. Returns True if successful."""
    try:
        pg = ProxyGenerator()
        success = pg.FreeProxies()
        if success:
            scholarly.use_proxy(pg)
            print("  Proxy configured successfully")
            return True
    except Exception as e:
        print(f"  Proxy setup failed: {e}")
    return False


def fetch_scholar(use_proxy=False):
    """Fetch scholar data. Optionally set up proxy first."""
    if use_proxy:
        print("  Setting up proxy...")
        if not try_setup_proxy():
            raise ConnectionError("Proxy setup failed")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"  Attempt {attempt}/{MAX_RETRIES}...")
            author = scholarly.search_author_id(SCHOLAR_ID)
            author = scholarly.fill(author, sections=['basics', 'indices'])

            h_index = author.get("hindex")
            i10_index = author.get("i10index")
            citations = author.get("citedby")

            if h_index is None and i10_index is None and citations is None:
                raise ValueError("Received empty metrics from Google Scholar")

            return {
                "name": author.get("name", "Ian T. Adams"),
                "affiliation": author.get("affiliation", "University of South Carolina"),
                "h_index": h_index or 0,
                "i10_index": i10_index or 0,
                "citations": citations or 0,
                "updated": datetime.now(timezone.utc).isoformat(),
                "scholar_url": f"https://scholar.google.com/citations?user={SCHOLAR_ID}"
            }
        except Exception as e:
            print(f"    Failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
            else:
                raise


def fetch_openalex_total_citations():
    """Fallback: sum cited_by_count from OpenAlex for all publications."""
    if requests is None:
        print("  requests library not available, cannot use OpenAlex fallback")
        return None

    oa_ids = [p.stem for p in sorted(PUBLICATIONS_DIR.glob("W*.md"))]
    if not oa_ids:
        return None

    total = 0
    batch_size = 50
    batches = [oa_ids[i:i + batch_size] for i in range(0, len(oa_ids), batch_size)]

    for batch_num, batch in enumerate(batches, 1):
        filter_ids = "|".join(f"https://openalex.org/{oid}" for oid in batch)
        params = {
            "filter": f"openalex_id:{filter_ids}",
            "select": "id,cited_by_count",
            "per_page": 200,
            "mailto": "ian.adams@sc.edu",
        }
        try:
            resp = requests.get("https://api.openalex.org/works", params=params, timeout=30)
            resp.raise_for_status()
            for work in resp.json().get("results", []):
                total += work.get("cited_by_count", 0)
        except Exception as e:
            print(f"  OpenAlex batch {batch_num} failed: {e}")
            return None
        if batch_num < len(batches):
            time.sleep(1)

    return total


def main():
    print(f"Fetching Google Scholar data for ID: {SCHOLAR_ID}")

    existing = load_existing_metrics()
    if existing and existing.get("h_index") is not None:
        print(f"  Existing data: h-index={existing.get('h_index')}, "
              f"i10-index={existing.get('i10_index')}, "
              f"citations={existing.get('citations')}")

    # Strategy 1: Direct Scholar fetch (no proxy)
    print("\nStep 1: Direct Scholar fetch...")
    try:
        metrics = fetch_scholar(use_proxy=False)
        print(f"  Success! h={metrics['h_index']}, i10={metrics['i10_index']}, "
              f"citations={metrics['citations']}")
        save_metrics(metrics)
        return
    except Exception as e:
        print(f"  Direct fetch failed: {e}")

    # Strategy 2: Scholar with proxy
    print("\nStep 2: Scholar fetch with proxy...")
    try:
        # Reset scholarly state before retrying with proxy
        scholarly.clear_proxy()
        metrics = fetch_scholar(use_proxy=True)
        print(f"  Success! h={metrics['h_index']}, i10={metrics['i10_index']}, "
              f"citations={metrics['citations']}")
        save_metrics(metrics)
        return
    except Exception as e:
        print(f"  Proxy fetch failed: {e}")

    # Strategy 3: OpenAlex fallback for total citations, preserve h-index/i10-index
    print("\nStep 3: OpenAlex fallback for total citations...")
    oa_total = fetch_openalex_total_citations()
    if oa_total is not None and existing and existing.get("h_index") is not None:
        print(f"  OpenAlex total: {oa_total} citations")
        metrics = {
            "name": existing.get("name", "Ian T. Adams"),
            "affiliation": existing.get("affiliation", "University of South Carolina"),
            "h_index": existing["h_index"],
            "i10_index": existing["i10_index"],
            "citations": oa_total,
            "updated": datetime.now(timezone.utc).isoformat(),
            "scholar_url": f"https://scholar.google.com/citations?user={SCHOLAR_ID}",
            "citation_source": "openalex"
        }
        save_metrics(metrics)
        return

    # All strategies failed — preserve existing data
    print("\nAll fetch strategies failed.")
    if existing and existing.get("h_index") is not None:
        print("Preserving existing valid data")
        existing["last_fetch_attempt"] = datetime.now(timezone.utc).isoformat()
        existing["last_fetch_error"] = "All strategies failed (direct, proxy, OpenAlex)"
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2)
    else:
        print("No existing valid data, writing fallback")
        fallback = {
            "name": "Ian T. Adams",
            "affiliation": "University of South Carolina",
            "h_index": None,
            "i10_index": None,
            "citations": None,
            "updated": datetime.now(timezone.utc).isoformat(),
            "scholar_url": f"https://scholar.google.com/citations?user={SCHOLAR_ID}",
            "error": "All strategies failed"
        }
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(fallback, f, indent=2)


def save_metrics(metrics):
    """Write metrics JSON to disk."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
