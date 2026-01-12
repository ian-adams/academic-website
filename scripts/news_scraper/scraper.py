"""
Main scraper orchestration.
Coordinates fetching, deduplication, classification, and export.
Supports multiple topics: ai-policing, k9, force-science
"""

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

import yaml

from .config import ScraperConfig, get_project_root
from .database import NewsDatabase, ArticleRecord
from .sources import GoogleNewsSource, NewsAPISource, Article
from .classifier import ArticleClassifier
from .export import export_to_json, generate_rss
from .topics import get_topic, keyword_prefilter, TOPICS

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
    topic: str = 'ai-policing',
    dry_run: bool = False
) -> dict:
    """
    Run the full scraper pipeline for a specific topic.

    Uses keyword pre-filtering then Claude API for final relevance classification.

    Args:
        topic: Topic name (ai-policing, k9, force-science)
        dry_run: Don't write to database or files

    Returns:
        Dict with statistics about the run
    """
    # Get topic configuration
    topic_config = get_topic(topic)
    project_root = get_project_root()

    # Load YAML config for this topic
    config_path = project_root / topic_config.config_file
    with open(config_path) as f:
        config = ScraperConfig(yaml.safe_load(f))

    # Set logging level from config
    logging.getLogger().setLevel(getattr(logging, config.log_level, logging.INFO))

    # Resolve paths
    db_path = project_root / 'assets' / 'db' / topic_config.db_name
    output_json = project_root / topic_config.json_output
    output_rss = project_root / topic_config.rss_output

    logger.info(f"Starting {topic_config.name} scraper run at {datetime.utcnow().isoformat()}Z")
    logger.info(f"Database: {db_path}")
    logger.info(f"Output JSON: {output_json}")

    stats = {
        'topic': topic,
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

    # Initialize classifier with topic-specific prompt
    classifier = ArticleClassifier(custom_prompt=topic_config.llm_prompt)

    # Pre-filter with keywords first to reduce LLM calls
    keyword_matches = []
    keyword_rejects = []
    for article in new_articles:
        if keyword_prefilter(article.title, article.snippet, topic_config):
            keyword_matches.append(article)
        else:
            keyword_rejects.append(article)

    logger.info(f"Keyword pre-filter: {len(keyword_matches)} potential matches, {len(keyword_rejects)} rejected")

    # Process keyword rejects (store as not relevant, no LLM call needed)
    for article in keyword_rejects:
        url_hash = NewsDatabase.hash_url(article.url)
        story_type = classifier.classify_story_type(article.title, article.snippet)

        record = ArticleRecord(
            url_hash=url_hash,
            url=article.url,
            title=article.title,
            source=article.source,
            date_published=article.date_published,
            date_scraped=datetime.utcnow().strftime('%Y-%m-%d'),
            snippet=article.snippet,
            is_relevant=0,  # Rejected by keyword filter
            relevance_reason='Failed keyword pre-filter',
            classification_model=None,
            classification_date=datetime.utcnow().isoformat() + 'Z',
            source_type=article.source_type,
            search_query=article.search_query,
            story_type=story_type,
            relevance_score=0.1,
            key_entities=None,
            location=None,
            tags=None
        )
        db.insert_article(record)

    # Process keyword matches with LLM classification
    logger.info(f"Running LLM classification on {len(keyword_matches)} keyword-matched articles...")

    for i, article in enumerate(keyword_matches):
        url_hash = NewsDatabase.hash_url(article.url)

        # LLM classification
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
            # On error, assume relevant (keyword matched)
            is_relevant = 1
            model_used = None
            stats['articles_relevant'] += 1

        # Rate limiting - 0.5s delay between LLM calls
        time.sleep(0.5)

        # Progress logging
        if (i + 1) % 25 == 0:
            logger.info(f"Classified {i + 1}/{len(keyword_matches)} articles")

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
        description='Multi-topic News Scraper (AI Policing, K9, Force Science)'
    )
    parser.add_argument(
        '--topic', '-t',
        type=str,
        default='ai-policing',
        choices=list(TOPICS.keys()),
        help=f"Topic to scrape: {', '.join(TOPICS.keys())}"
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
        topic=args.topic,
        dry_run=args.dry_run
    )

    # Print summary
    print(f"\n=== {stats['topic'].upper()} Scraper Run Summary ===")
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
