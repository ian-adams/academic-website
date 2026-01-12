"""
Main scraper orchestration.
Coordinates fetching, deduplication, classification, and export.
"""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

from .config import ScraperConfig, get_db_path, get_output_json_path, get_output_rss_path
from .database import NewsDatabase, ArticleRecord
from .sources import GoogleNewsSource, NewsAPISource, Article
from .classifier import ArticleClassifier
from .export import export_to_json, generate_rss

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def run_scraper(
    config_path: str | Path | None = None,
    db_path: str | Path | None = None,
    output_json: str | Path | None = None,
    output_rss: str | Path | None = None,
    use_llm: bool = False,
    dry_run: bool = False
) -> dict:
    """
    Run the full scraper pipeline.

    Args:
        config_path: Path to config file (optional)
        db_path: Path to SQLite database (optional)
        output_json: Path to output JSON (optional)
        output_rss: Path to output RSS (optional)
        use_llm: Use Claude API for classification (default: keyword-based)
        dry_run: Don't write to database or files

    Returns:
        Dict with statistics about the run
    """
    # Load configuration
    config = ScraperConfig(None if config_path is None else None)
    if config_path:
        import yaml
        with open(config_path) as f:
            config = ScraperConfig(yaml.safe_load(f))

    # Set logging level from config
    logging.getLogger().setLevel(getattr(logging, config.log_level, logging.INFO))

    # Resolve paths
    db_path = Path(db_path) if db_path else get_db_path()
    output_json = Path(output_json) if output_json else get_output_json_path()
    output_rss = Path(output_rss) if output_rss else get_output_rss_path()

    logger.info(f"Starting scraper run at {datetime.utcnow().isoformat()}Z")
    logger.info(f"Database: {db_path}")
    logger.info(f"Output JSON: {output_json}")

    stats = {
        'started_at': datetime.utcnow().isoformat() + 'Z',
        'articles_fetched': 0,
        'articles_new': 0,
        'articles_classified': 0,
        'articles_relevant': 0,
        'articles_exported': 0,
        'errors': []
    }

    # Initialize database
    db = NewsDatabase(db_path)
    existing_hashes = db.get_existing_hashes()
    logger.info(f"Database has {len(existing_hashes)} existing articles")

    # Initialize sources
    sources = [
        GoogleNewsSource(config.to_dict()),
        NewsAPISource(config.to_dict()),
    ]

    # Fetch articles from all sources
    all_articles: list[Article] = []
    for source in sources:
        try:
            articles = source.fetch()
            all_articles.extend(articles)
            logger.info(f"Fetched {len(articles)} from {source.source_type}")
        except Exception as e:
            logger.error(f"Error fetching from {source.source_type}: {e}")
            stats['errors'].append(f"{source.source_type}: {str(e)}")

    stats['articles_fetched'] = len(all_articles)

    # Deduplicate against existing database
    new_articles = []
    for article in all_articles:
        url_hash = NewsDatabase.hash_url(article.url)
        if url_hash not in existing_hashes:
            new_articles.append(article)
            existing_hashes.add(url_hash)  # Prevent duplicates within batch

    logger.info(f"Found {len(new_articles)} new articles (after deduplication)")
    stats['articles_new'] = len(new_articles)

    if dry_run:
        logger.info("Dry run - skipping database writes and classification")
        db.close()
        stats['finished_at'] = datetime.utcnow().isoformat() + 'Z'
        return stats

    # Initialize classifier (with or without LLM)
    classifier = ArticleClassifier(api_key=None if not use_llm else None)  # Pass None to disable LLM

    logger.info(f"Classification mode: {'LLM (Claude API)' if use_llm else 'keyword-based'}")

    # Process and store new articles
    for article in new_articles:
        url_hash = NewsDatabase.hash_url(article.url)

        # Classify relevance (keyword-based by default, LLM if use_llm=True)
        if use_llm:
            try:
                is_relevant_bool, model_used = classifier.classify_relevance(
                    article.title,
                    article.snippet,
                    article.source
                )
                is_relevant = 1 if is_relevant_bool else 0
                stats['articles_classified'] += 1
                if is_relevant:
                    stats['articles_relevant'] += 1
            except Exception as e:
                logger.warning(f"LLM classification failed for '{article.title[:50]}': {e}")
                # Fallback to keyword-based
                is_relevant = 1 if classifier._keyword_relevance(article.title, article.snippet) else 0
                model_used = None
        else:
            # Keyword-based classification (fast, no API calls)
            is_relevant = 1 if classifier._keyword_relevance(article.title, article.snippet) else 0
            model_used = None
            stats['articles_classified'] += 1
            if is_relevant:
                stats['articles_relevant'] += 1

        # Classify story type
        story_type = classifier.classify_story_type(article.title, article.snippet)

        # Extract entities and tags
        key_entities = classifier.extract_entities(article.title, article.snippet)
        tags = classifier.extract_tags(article.title, article.snippet)

        # Create database record
        record = ArticleRecord(
            url_hash=url_hash,
            url=article.url,
            title=article.title,
            source=article.source,
            date_published=article.date_published,
            date_scraped=datetime.utcnow().strftime('%Y-%m-%d'),
            snippet=article.snippet,
            is_relevant=is_relevant,
            relevance_reason=None,
            classification_model=model_used,
            classification_date=datetime.utcnow().isoformat() + 'Z' if is_relevant is not None else None,
            source_type=article.source_type,
            search_query=article.search_query,
            story_type=story_type,
            relevance_score=0.85 if is_relevant == 1 else (0.3 if is_relevant == 0 else None),
            key_entities=key_entities,
            location=None,
            tags=','.join(tags) if tags else None
        )

        db.insert_article(record)

    # Export to JSON and RSS
    try:
        exported = export_to_json(db, output_json, config.max_stories_json)
        stats['articles_exported'] = exported
    except Exception as e:
        logger.error(f"Error exporting JSON: {e}")
        stats['errors'].append(f"JSON export: {str(e)}")

    try:
        generate_rss(db, output_rss, config.max_stories_rss)
    except Exception as e:
        logger.error(f"Error generating RSS: {e}")
        stats['errors'].append(f"RSS export: {str(e)}")

    # Log final stats
    db_stats = db.get_stats()
    logger.info(f"Database stats: {db_stats}")

    db.close()

    stats['finished_at'] = datetime.utcnow().isoformat() + 'Z'
    logger.info(f"Scraper run complete: {stats}")

    return stats


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='AI Policing News Scraper'
    )
    parser.add_argument(
        '--config', '-c',
        type=str,
        help='Path to config YAML file'
    )
    parser.add_argument(
        '--db', '-d',
        type=str,
        help='Path to SQLite database'
    )
    parser.add_argument(
        '--output-json', '-o',
        type=str,
        help='Path to output JSON file'
    )
    parser.add_argument(
        '--output-rss', '-r',
        type=str,
        help='Path to output RSS file'
    )
    parser.add_argument(
        '--use-llm',
        action='store_true',
        help='Use Claude API for relevance classification (default: keyword-based)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Fetch articles but do not write to database'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    stats = run_scraper(
        config_path=args.config,
        db_path=args.db,
        output_json=args.output_json,
        output_rss=args.output_rss,
        use_llm=args.use_llm,
        dry_run=args.dry_run
    )

    # Print summary
    print("\n=== Scraper Run Summary ===")
    print(f"Articles fetched: {stats['articles_fetched']}")
    print(f"New articles: {stats['articles_new']}")
    print(f"Classified: {stats['articles_classified']}")
    print(f"Relevant: {stats['articles_relevant']}")
    print(f"Exported: {stats['articles_exported']}")

    if stats['errors']:
        print(f"\nErrors ({len(stats['errors'])}):")
        for err in stats['errors']:
            print(f"  - {err}")
        sys.exit(1)


if __name__ == '__main__':
    main()
