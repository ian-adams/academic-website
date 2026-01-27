#!/usr/bin/env python3
"""
Fetch Google Scholar metrics for Ian T. Adams
Saves h-index, i10-index, and total citations to a JSON file

Uses free proxies to avoid Google Scholar blocking GitHub Actions IPs.
Preserves existing data if fetch fails (doesn't overwrite good data with errors).
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from scholarly import scholarly, ProxyGenerator
except ImportError:
    print("Please install scholarly: pip install scholarly")
    exit(1)

SCHOLAR_ID = "g9lY5RUAAAAJ"
SCRIPT_DIR = Path(__file__).parent
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "scholar-metrics.json"
MAX_RETRIES = 3
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


def setup_proxy():
    """Set up a free proxy to avoid Google Scholar blocking."""
    print("Setting up proxy to avoid Google Scholar blocking...")
    try:
        pg = ProxyGenerator()
        # Try FreeProxies first (no API key needed)
        success = pg.FreeProxies()
        if success:
            scholarly.use_proxy(pg)
            print("  Proxy configured successfully")
            return True
    except Exception as e:
        print(f"  Warning: Could not set up proxy: {e}")
    return False


def fetch_with_retry():
    """Fetch scholar data with retry logic."""
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"Attempt {attempt}/{MAX_RETRIES}: Fetching author data...")
            author = scholarly.search_author_id(SCHOLAR_ID)
            author = scholarly.fill(author, sections=['basics', 'indices'])

            # Validate we got actual data
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
            last_error = e
            print(f"  Attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                print(f"  Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)

    raise last_error


def main():
    print(f"Fetching Google Scholar data for ID: {SCHOLAR_ID}")

    # Load existing data first
    existing = load_existing_metrics()
    if existing and existing.get("h_index") is not None:
        print(f"  Existing data: h-index={existing.get('h_index')}, "
              f"i10-index={existing.get('i10_index')}, "
              f"citations={existing.get('citations')}")

    # Set up proxy
    setup_proxy()

    try:
        # Fetch new data
        metrics = fetch_with_retry()

        print(f"  Success!")
        print(f"  h-index: {metrics['h_index']}")
        print(f"  i10-index: {metrics['i10_index']}")
        print(f"  Total citations: {metrics['citations']}")

        # Ensure output directory exists
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Write JSON
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2)

        print(f"Saved to {OUTPUT_PATH}")

    except Exception as e:
        print(f"Error fetching data after {MAX_RETRIES} attempts: {e}")

        # IMPORTANT: Don't overwrite good data with error data
        if existing and existing.get("h_index") is not None:
            print("Preserving existing valid data (not overwriting with error)")
            # Update just the timestamp to show we tried
            existing["last_fetch_attempt"] = datetime.now(timezone.utc).isoformat()
            existing["last_fetch_error"] = str(e)
            with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
                json.dump(existing, f, indent=2)
        else:
            # No existing valid data, write fallback
            print("No existing valid data, writing fallback")
            fallback = {
                "name": "Ian T. Adams",
                "affiliation": "University of South Carolina",
                "h_index": None,
                "i10_index": None,
                "citations": None,
                "updated": datetime.now(timezone.utc).isoformat(),
                "scholar_url": f"https://scholar.google.com/citations?user={SCHOLAR_ID}",
                "error": str(e)
            }
            OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
                json.dump(fallback, f, indent=2)


if __name__ == "__main__":
    main()
