#!/usr/bin/env python3
"""
Fetch Google Scholar metrics for Ian T. Adams
Saves h-index, i10-index, and total citations to a JSON file
"""

import json
from datetime import datetime, timezone
from pathlib import Path

try:
    from scholarly import scholarly
except ImportError:
    print("Please install scholarly: pip install scholarly")
    exit(1)

SCHOLAR_ID = "g9lY5RUAAAAJ"
SCRIPT_DIR = Path(__file__).parent
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "scholar-metrics.json"


def main():
    print(f"Fetching Google Scholar data for ID: {SCHOLAR_ID}")

    try:
        # Fetch author data
        author = scholarly.search_author_id(SCHOLAR_ID)
        author = scholarly.fill(author, sections=['basics', 'indices'])

        # Extract metrics
        metrics = {
            "name": author.get("name", "Ian T. Adams"),
            "affiliation": author.get("affiliation", "University of South Carolina"),
            "h_index": author.get("hindex", 0),
            "i10_index": author.get("i10index", 0),
            "citations": author.get("citedby", 0),
            "updated": datetime.now(timezone.utc).isoformat(),
            "scholar_url": f"https://scholar.google.com/citations?user={SCHOLAR_ID}"
        }

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
        print(f"Error fetching data: {e}")
        # Write fallback data so the site doesn't break
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
        print(f"Saved fallback data to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
