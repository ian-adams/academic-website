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
from .classifier import ArticleClassifier, ForceScienceClassification
from .export import export_to_json, generate_rss, export_force_science_feeds
from .topics import get_topic, keyword_prefilter, force_science_prefilter_with_diagnostics, TOPICS

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

    # Force Science uses a different classification pipeline
    if topic == 'force-science':
        stats = _process_force_science_articles(
            new_articles, db, classifier, topic_config, stats, config,
            output_json, output_rss
        )
    else:
        stats = _process_standard_articles(
            new_articles, db, classifier, topic_config, stats, config,
            output_json, output_rss
        )

    # Log final stats
    db_stats = db.get_stats()
    logger.info(f"Database stats: {db_stats}")

    db.close()

    stats['finished_at'] = datetime.utcnow().isoformat() + 'Z'
    logger.info(f"Scraper run complete: {stats}")

    return stats


def _process_standard_articles(
    new_articles: list,
    db: NewsDatabase,
    classifier: ArticleClassifier,
    topic_config,
    stats: dict,
    config,
    output_json,
    output_rss
) -> dict:
    """Process articles using standard YES/NO classification pipeline."""
    import json

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
            is_relevant=0,
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
            is_relevant = 1
            model_used = None
            stats['articles_relevant'] += 1

        time.sleep(0.5)

        if (i + 1) % 25 == 0:
            logger.info(f"Classified {i + 1}/{len(keyword_matches)} articles")

        story_type = classifier.classify_story_type(article.title, article.snippet)
        key_entities = classifier.extract_entities(article.title, article.snippet)
        tags = classifier.extract_tags(article.title, article.snippet)

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

    # Export
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

    return stats


def _process_force_science_articles(
    new_articles: list,
    db: NewsDatabase,
    classifier: ArticleClassifier,
    topic_config,
    stats: dict,
    config,
    output_json,
    output_rss
) -> dict:
    """
    Process articles using Force Science multi-label classification pipeline.

    Stage 1: Keyword pre-filter with diagnostics
    Stage 2: LLM classification with JSON output (label/confidence/relevance/signals/entities/rationale)

    Persistence policy:
    - Store DIRECT, PROXY, ADJACENT
    - Drop NO (or store with is_relevant=0 for denominator calculations)
    """
    import json

    # Add Force Science specific stats
    stats['label_direct'] = 0
    stats['label_proxy'] = 0
    stats['label_adjacent'] = 0
    stats['label_no'] = 0
    stats['stage1_passed'] = 0
    stats['stage1_rejected'] = 0

    # Stage 1: Keyword pre-filter with diagnostics
    keyword_matches = []
    keyword_rejects = []
    diagnostics_log = []

    for article in new_articles:
        # Get full diagnostics for Force Science
        diag = force_science_prefilter_with_diagnostics(article.title, article.snippet, topic_config)
        diag['url'] = article.url
        diag['title'] = article.title[:100]
        diagnostics_log.append(diag)

        if diag['should_call_llm']:
            keyword_matches.append((article, diag))
            stats['stage1_passed'] += 1
        else:
            keyword_rejects.append((article, diag))
            stats['stage1_rejected'] += 1

    logger.info(f"Force Science Stage 1: {len(keyword_matches)} passed, {len(keyword_rejects)} rejected")

    # Log Stage 1 diagnostics summary
    trigger_reasons = {}
    for diag in diagnostics_log:
        reason = diag.get('trigger_reason') or 'no_match'
        trigger_reasons[reason] = trigger_reasons.get(reason, 0) + 1
    logger.info(f"Stage 1 trigger reasons: {trigger_reasons}")

    # Process keyword rejects (store with label=NO for later analysis)
    for article, diag in keyword_rejects:
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
            is_relevant=0,
            relevance_reason='Failed Stage 1 keyword pre-filter',
            classification_model=None,
            classification_date=datetime.utcnow().isoformat() + 'Z',
            source_type=article.source_type,
            search_query=article.search_query,
            story_type=story_type,
            relevance_score=0.0,
            key_entities=None,
            location=None,
            tags=None,
            # Force Science specific fields
            article_label='NO',
            label_confidence=1.0,  # High confidence it's not relevant
            label_relevance=0,
            signals=None,
            entities_extracted=None,
            rationale='Failed Stage 1 keyword pre-filter',
            stage1_diagnostics=json.dumps(diag)
        )
        db.insert_article(record)
        stats['label_no'] += 1

    # Stage 2: LLM classification for keyword matches
    logger.info(f"Running Force Science LLM classification on {len(keyword_matches)} articles...")

    for i, (article, diag) in enumerate(keyword_matches):
        url_hash = NewsDatabase.hash_url(article.url)

        # Call LLM with Force Science JSON prompt
        try:
            classification = classifier.classify_force_science(
                article.title,
                article.snippet,
                article.source,
                topic_config.llm_prompt
            )
            stats['articles_classified'] += 1

            # Track label counts
            if classification.label == 'DIRECT':
                stats['label_direct'] += 1
                stats['articles_relevant'] += 1
            elif classification.label == 'PROXY':
                stats['label_proxy'] += 1
                stats['articles_relevant'] += 1
            elif classification.label == 'ADJACENT':
                stats['label_adjacent'] += 1
                stats['articles_relevant'] += 1
            else:
                stats['label_no'] += 1

        except Exception as e:
            logger.warning(f"LLM classification failed for '{article.title[:50]}': {e}")
            # On error, use Stage 1 diagnostics to make a best guess
            classification = _fallback_classification_from_diagnostics(diag)

        # Rate limiting
        time.sleep(0.5)

        if (i + 1) % 25 == 0:
            logger.info(f"Classified {i + 1}/{len(keyword_matches)} articles")

        # Classify story type
        story_type = classifier.classify_story_type(article.title, article.snippet)

        # Use entities from LLM if available, otherwise extract
        key_entities = ', '.join(classification.entities) if classification.entities else classifier.extract_entities(article.title, article.snippet)
        tags = classifier.extract_tags(article.title, article.snippet)

        # Calculate legacy relevance_score from new relevance (0-100 -> 0.0-1.0)
        relevance_score = classification.relevance / 100.0

        record = ArticleRecord(
            url_hash=url_hash,
            url=article.url,
            title=article.title,
            source=article.source,
            date_published=article.date_published,
            date_scraped=datetime.utcnow().strftime('%Y-%m-%d'),
            snippet=article.snippet,
            is_relevant=classification.to_is_relevant_int(),
            relevance_reason=classification.rationale,
            classification_model='claude-3-haiku-20240307',
            classification_date=datetime.utcnow().isoformat() + 'Z',
            source_type=article.source_type,
            search_query=article.search_query,
            story_type=story_type,
            relevance_score=relevance_score,
            key_entities=key_entities,
            location=None,
            tags=','.join(tags) if tags else None,
            # Force Science specific fields
            article_label=classification.label,
            label_confidence=classification.confidence,
            label_relevance=classification.relevance,
            signals=classification.signals_json(),
            entities_extracted=classification.entities_json(),
            rationale=classification.rationale,
            stage1_diagnostics=json.dumps(diag)
        )
        db.insert_article(record)

    # Export using Force Science specific export
    try:
        exported = export_force_science_feeds(db, output_json, output_rss, config.max_stories_json)
        stats['articles_exported'] = exported
    except Exception as e:
        logger.error(f"Error exporting Force Science feeds: {e}")
        stats['errors'].append(f"Force Science export: {str(e)}")
        # Fall back to standard export
        try:
            exported = export_to_json(db, output_json, config.max_stories_json)
            stats['articles_exported'] = exported
            generate_rss(db, output_rss, config.max_stories_rss)
        except Exception as e2:
            logger.error(f"Fallback export also failed: {e2}")

    return stats


def _fallback_classification_from_diagnostics(diag: dict) -> ForceScienceClassification:
    """
    Create a fallback classification when LLM fails, based on Stage 1 diagnostics.
    """
    # If direct anchors hit, assume DIRECT
    if diag.get('direct_anchors_hit'):
        return ForceScienceClassification(
            label='DIRECT',
            confidence=0.5,
            relevance=80,
            signals=diag.get('direct_anchors_hit', []),
            entities=[],
            rationale='Fallback from Stage 1 diagnostics - direct anchor match'
        )

    # If proxy anchors hit, assume PROXY
    if diag.get('proxy_anchors_hit'):
        return ForceScienceClassification(
            label='PROXY',
            confidence=0.5,
            relevance=70,
            signals=diag.get('proxy_anchors_hit', []),
            entities=[],
            rationale='Fallback from Stage 1 diagnostics - proxy anchor match'
        )

    # If names hit with context, use appropriate label
    if diag.get('names_direct_hit'):
        return ForceScienceClassification(
            label='PROXY',
            confidence=0.4,
            relevance=60,
            signals=diag.get('names_direct_hit', []),
            entities=diag.get('names_direct_hit', []),
            rationale='Fallback from Stage 1 diagnostics - direct name match'
        )

    # If adjacent bundle, assume ADJACENT
    if diag.get('trigger_reason') == 'adjacent_bundle':
        signals = (diag.get('expert_mechanics_hit', []) +
                   diag.get('police_force_hit', []) +
                   diag.get('court_context_hit', []))
        return ForceScienceClassification(
            label='ADJACENT',
            confidence=0.4,
            relevance=50,
            signals=signals[:5],  # Limit to first 5
            entities=[],
            rationale='Fallback from Stage 1 diagnostics - adjacent bundle match'
        )

    # Default to ADJACENT if it passed Stage 1
    return ForceScienceClassification(
        label='ADJACENT',
        confidence=0.3,
        relevance=40,
        signals=[],
        entities=[],
        rationale='Fallback classification - passed Stage 1 but LLM failed'
    )


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

    # Force Science specific stats
    if stats['topic'] == 'force-science':
        print(f"\n--- Force Science Labels ---")
        print(f"Stage 1 passed: {stats.get('stage1_passed', 0)}")
        print(f"Stage 1 rejected: {stats.get('stage1_rejected', 0)}")
        print(f"DIRECT: {stats.get('label_direct', 0)}")
        print(f"PROXY: {stats.get('label_proxy', 0)}")
        print(f"ADJACENT: {stats.get('label_adjacent', 0)}")
        print(f"NO: {stats.get('label_no', 0)}")

    if stats['errors']:
        print(f"\nErrors ({len(stats['errors'])}):")
        for err in stats['errors']:
            print(f"  - {err}")
        sys.exit(1)


if __name__ == '__main__':
    main()
