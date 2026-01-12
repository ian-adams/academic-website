"""
Migration script - imports existing articles from JSON into SQLite.
Run this once to seed the database from the existing ai-police-news.json.
"""

import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from .config import get_db_path, get_output_json_path
from .database import NewsDatabase, ArticleRecord

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_from_json(
    json_path: str | Path | None = None,
    db_path: str | Path | None = None
) -> int:
    """
    Import existing articles from JSON file into SQLite database.

    Args:
        json_path: Path to source JSON file
        db_path: Path to SQLite database

    Returns:
        Number of articles imported
    """
    json_path = Path(json_path) if json_path else get_output_json_path()
    db_path = Path(db_path) if db_path else get_db_path()

    logger.info(f"Migrating from {json_path} to {db_path}")

    if not json_path.exists():
        logger.error(f"JSON file not found: {json_path}")
        return 0

    # Load existing JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    stories = data.get('stories', [])
    logger.info(f"Found {len(stories)} stories in JSON")

    # Initialize database
    db = NewsDatabase(db_path)

    imported = 0
    skipped = 0

    for story in stories:
        # Map JSON fields to database record
        url = story.get('url', '')
        if not url:
            logger.warning(f"Skipping story without URL: {story.get('title', 'Unknown')}")
            skipped += 1
            continue

        # Use existing ID as url_hash, or compute new one
        url_hash = story.get('id') or NewsDatabase.hash_url(url)

        # Helper to convert lists to comma-separated strings
        def to_string(val):
            if val is None:
                return ''
            if isinstance(val, list):
                return ','.join(str(v) for v in val)
            return str(val)

        # Handle all potentially list fields
        tags = to_string(story.get('tags', []))
        key_entities = to_string(story.get('key_entities', ''))
        location = to_string(story.get('location', ''))

        record = ArticleRecord(
            url_hash=url_hash,
            url=url,
            title=story.get('title', ''),
            source=story.get('source', 'Unknown'),
            date_published=story.get('date'),
            date_scraped=story.get('date_discovered') or datetime.utcnow().strftime('%Y-%m-%d'),
            snippet=story.get('summary', ''),
            is_relevant=1,  # All existing stories are relevant (they were published)
            relevance_reason='Migrated from existing JSON',
            classification_model='legacy_r_system',
            classification_date=datetime.utcnow().isoformat() + 'Z',
            source_type='google_news',  # Most were from Google News
            search_query=None,
            story_type=story.get('story_type', 'general'),
            relevance_score=story.get('relevance_score'),
            key_entities=key_entities,
            location=location,
            tags=tags
        )

        if db.insert_article(record):
            imported += 1
        else:
            skipped += 1
            logger.debug(f"Skipped duplicate: {story.get('title', '')[:50]}")

    db.close()

    logger.info(f"Migration complete: {imported} imported, {skipped} skipped")
    return imported


def main():
    """CLI entry point for migration."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Migrate existing articles from JSON to SQLite'
    )
    parser.add_argument(
        '--json', '-j',
        type=str,
        help='Path to source JSON file'
    )
    parser.add_argument(
        '--db', '-d',
        type=str,
        help='Path to SQLite database'
    )

    args = parser.parse_args()

    imported = migrate_from_json(
        json_path=args.json,
        db_path=args.db
    )

    print(f"\nMigration complete: {imported} articles imported")


if __name__ == '__main__':
    main()
