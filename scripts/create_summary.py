#!/usr/bin/env python3
"""Generate summary report from run history for GitHub Actions"""

import json
from pathlib import Path


def main():
    history_path = Path('data/run_history.json')

    if not history_path.exists():
        print("Run history file not found")
        return

    with open(history_path, 'r', encoding='utf-8') as f:
        history = json.load(f)

    if not history.get('runs'):
        print("No runs recorded yet")
        return

    latest_run = history['runs'][-1]

    # Status emoji
    status_emoji = "✅" if latest_run['status'] == 'success' else "⚠️"

    print(f"{status_emoji} **Status:** {latest_run['status']}")
    print(f"- **Timestamp:** {latest_run['timestamp']}")
    print(f"- **New articles:** {latest_run['new_articles']}")
    print(f"- **Updated citations:** {latest_run['updated_citations']}")
    print(f"- **Synopses generated:** {latest_run['synopsis_generated']}")
    print(f"- **Synopses regenerated:** {latest_run['synopsis_regenerated']}")
    print(f"- **Errors:** {latest_run['errors']}")
    print(f"- **Duration:** {latest_run['duration_seconds']}s")

    if latest_run.get('dry_run'):
        print("- **Mode:** 🔍 DRY RUN (no changes saved)")

    if latest_run.get('error_details'):
        print("\n### ⚠️ Errors:")
        for error in latest_run['error_details']:
            title = error.get('article_title', 'Unknown')
            print(f"- **{title}**")
            print(f"  - Error: `{error.get('error', 'Unknown error')}`")
            if error.get('timestamp'):
                print(f"  - Time: {error['timestamp']}")


if __name__ == '__main__':
    main()
