"""
Export module - generates Hugo-compatible JSON from database.
Supports both standard exports and Force Science multi-label exports.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from .database import NewsDatabase
from .classifier import ArticleClassifier

logger = logging.getLogger(__name__)


def export_force_science_feeds(
    db: NewsDatabase,
    output_json: str | Path,
    output_rss: str | Path,
    max_stories: int = 0
) -> int:
    """
    Export Force Science articles with label-aware separation.

    Creates:
    - Primary JSON feed (DIRECT + PROXY), sorted by relevance desc then recency
    - Adjacent JSON feed (ADJACENT only), sorted the same way
    - RSS feed with DIRECT + PROXY articles

    Args:
        db: NewsDatabase instance
        output_json: Path to primary JSON file (adjacent will be output_json.replace('.json', '-adjacent.json'))
        output_rss: Path to RSS output file
        max_stories: Maximum stories per feed (0 = no limit)

    Returns:
        Total number of stories exported across all feeds
    """
    output_json = Path(output_json)
    output_rss = Path(output_rss)
    output_json.parent.mkdir(parents=True, exist_ok=True)

    classifier = ArticleClassifier()
    total_exported = 0

    # Primary feed: DIRECT + PROXY
    primary_articles = db.get_primary_feed_articles(limit=max_stories if max_stories > 0 else None)
    primary_stories = []
    for article in primary_articles:
        story = transform_force_science_article(article, classifier)
        primary_stories.append(story)

    primary_output = {
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "feed_type": "primary",
        "description": "Force Science direct and proxy mentions",
        "count": len(primary_stories),
        "stories": primary_stories
    }

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(primary_output, f, indent=2, ensure_ascii=False)

    logger.info(f"Exported {len(primary_stories)} primary (DIRECT+PROXY) stories to {output_json}")
    total_exported += len(primary_stories)

    # Adjacent feed: ADJACENT only
    adjacent_json = output_json.with_name(output_json.stem + '-adjacent.json')
    adjacent_articles = db.get_adjacent_feed_articles(limit=max_stories if max_stories > 0 else None)
    adjacent_stories = []
    for article in adjacent_articles:
        story = transform_force_science_article(article, classifier)
        adjacent_stories.append(story)

    adjacent_output = {
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "feed_type": "adjacent",
        "description": "Expert testimony ecosystem - police use-of-force litigation",
        "count": len(adjacent_stories),
        "stories": adjacent_stories
    }

    with open(adjacent_json, 'w', encoding='utf-8') as f:
        json.dump(adjacent_output, f, indent=2, ensure_ascii=False)

    logger.info(f"Exported {len(adjacent_stories)} adjacent stories to {adjacent_json}")
    total_exported += len(adjacent_stories)

    # RSS feed: DIRECT + PROXY only (primary feed)
    generate_force_science_rss(
        primary_articles,
        output_rss,
        max_stories=max_stories if max_stories > 0 else 100
    )

    return total_exported


def transform_force_science_article(article: dict, classifier: ArticleClassifier) -> dict:
    """
    Transform Force Science article to JSON format with label info.
    """
    # Parse tags
    tags = []
    if article.get('tags'):
        if isinstance(article['tags'], str):
            tags = [t.strip() for t in article['tags'].split(',') if t.strip()]
        else:
            tags = article['tags']

    if not tags:
        tags = classifier.extract_tags(article['title'], article.get('snippet'))

    # Parse signals from JSON
    signals = []
    if article.get('signals'):
        try:
            signals = json.loads(article['signals'])
        except (json.JSONDecodeError, TypeError):
            signals = []

    # Parse entities from JSON
    entities = []
    if article.get('entities_extracted'):
        try:
            entities = json.loads(article['entities_extracted'])
        except (json.JSONDecodeError, TypeError):
            entities = []

    # Use key_entities if entities_extracted is empty
    key_entities = article.get('key_entities', '')
    if not key_entities and entities:
        key_entities = ', '.join(entities)
    elif not key_entities:
        key_entities = classifier.extract_entities(article['title'], article.get('snippet'))

    # Get relevance score
    relevance_score = article.get('relevance_score')
    if relevance_score is None and article.get('label_relevance') is not None:
        relevance_score = article['label_relevance'] / 100.0

    # Determine if needs review
    needs_review = 0
    confidence = article.get('label_confidence', 1.0)
    if confidence and confidence < 0.6:
        needs_review = 1

    return {
        "id": article['url_hash'],
        "url": article['url'],
        "title": article['title'],
        "source": article.get('source', 'Unknown'),
        "date": article.get('date_published') or article['date_scraped'][:10],
        "date_discovered": article['date_scraped'][:10] if article['date_scraped'] else None,
        "summary": article.get('snippet', ''),
        "story_type": article.get('story_type', 'general'),
        # Force Science specific fields
        "label": article.get('article_label', 'NO'),
        "confidence": round(article.get('label_confidence', 0.0), 2),
        "relevance": article.get('label_relevance', 0),
        "relevance_score": round(relevance_score, 2) if relevance_score else 0.0,
        "signals": signals,
        "entities": entities,
        "rationale": article.get('rationale', ''),
        "key_entities": key_entities,
        "location": article.get('location', ''),
        "tags": tags,
        "needs_review": needs_review
    }


def generate_force_science_rss(
    articles: list[dict],
    output_path: str | Path,
    max_stories: int = 100,
    site_url: str = "https://ian-adams.com",
    feed_title: str = "Force Science News",
    feed_description: str = "News about Force Science Institute and police use-of-force expert testimony"
) -> int:
    """
    Generate RSS feed for Force Science articles.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Limit articles
    articles = articles[:max_stories]

    rss_items = []
    for article in articles:
        pub_date = article.get('date_published') or article['date_scraped'][:10]
        label = article.get('article_label', '')
        label_tag = f" [{label}]" if label else ""

        item = f"""    <item>
      <title><![CDATA[{article['title']}{label_tag}]]></title>
      <link>{article['url']}</link>
      <guid isPermaLink="true">{article['url']}</guid>
      <pubDate>{pub_date}</pubDate>
      <description><![CDATA[{article.get('snippet', '')}]]></description>
      <source>{article.get('source', 'Unknown')}</source>
      <category>{label}</category>
    </item>"""
        rss_items.append(item)

    rss_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{feed_title}</title>
    <link>{site_url}/force-science/</link>
    <description>{feed_description}</description>
    <language>en-us</language>
    <lastBuildDate>{datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000")}</lastBuildDate>
    <atom:link href="{site_url}/data/force-science-news.xml" rel="self" type="application/rss+xml"/>
{chr(10).join(rss_items)}
  </channel>
</rss>"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rss_content)

    logger.info(f"Generated Force Science RSS feed with {len(articles)} stories at {output_path}")
    return len(articles)


def export_to_json(
    db: NewsDatabase,
    output_path: str | Path,
    max_stories: int = 0
) -> int:
    """
    Export relevant articles to Hugo-compatible JSON.

    Args:
        db: NewsDatabase instance
        output_path: Path to output JSON file
        max_stories: Maximum number of stories (0 = no limit)

    Returns:
        Number of stories exported
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Get relevant articles from database (0 = no limit)
    limit = max_stories if max_stories > 0 else None
    articles = db.get_relevant_articles(limit=limit)

    # Transform to Hugo format
    stories = []
    classifier = ArticleClassifier()  # For entity/tag extraction

    for article in articles:
        story = transform_article(article, classifier)
        stories.append(story)

    # Build output structure
    output = {
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(stories),
        "stories": stories
    }

    # Write JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    logger.info(f"Exported {len(stories)} stories to {output_path}")
    return len(stories)


def transform_article(article: dict, classifier: ArticleClassifier) -> dict:
    """
    Transform database article to Hugo JSON format.

    Args:
        article: Database row as dict
        classifier: ArticleClassifier for entity/tag extraction

    Returns:
        Hugo-compatible story dict
    """
    # Parse existing tags if stored as string
    tags = []
    if article.get('tags'):
        if isinstance(article['tags'], str):
            tags = [t.strip() for t in article['tags'].split(',') if t.strip()]
        else:
            tags = article['tags']

    # Extract fresh tags if none exist
    if not tags:
        tags = classifier.extract_tags(
            article['title'],
            article.get('snippet')
        )

    # Get or extract entities
    key_entities = article.get('key_entities', '')
    if not key_entities:
        key_entities = classifier.extract_entities(
            article['title'],
            article.get('snippet')
        )

    # Calculate relevance score (1.0 for LLM-approved, else based on keywords)
    relevance_score = article.get('relevance_score')
    if relevance_score is None:
        # If classified by LLM as relevant, give high score
        if article.get('is_relevant') == 1:
            relevance_score = 0.85
        else:
            relevance_score = 0.5

    # Determine if needs review (for manual queue)
    needs_review = 0
    if 0.4 <= relevance_score < 0.7:
        needs_review = 1

    return {
        "id": article['url_hash'],
        "url": article['url'],
        "title": article['title'],
        "source": article.get('source', 'Unknown'),
        "date": article.get('date_published') or article['date_scraped'][:10],
        "date_discovered": article['date_scraped'][:10] if article['date_scraped'] else None,
        "summary": article.get('snippet', ''),
        "story_type": article.get('story_type', 'general'),
        "relevance_score": round(relevance_score, 2),
        "key_entities": key_entities,
        "location": article.get('location', ''),
        "tags": tags,
        "needs_review": needs_review
    }


def generate_rss(
    db: NewsDatabase,
    output_path: str | Path,
    max_stories: int = 50,
    site_url: str = "https://ian-adams.com",
    feed_title: str = "AI Police News",
    feed_description: str = "News about AI and automated technology in US law enforcement"
) -> int:
    """
    Generate RSS feed from relevant articles.

    Args:
        db: NewsDatabase instance
        output_path: Path to output RSS/XML file
        max_stories: Maximum number of stories
        site_url: Base site URL
        feed_title: RSS feed title
        feed_description: RSS feed description

    Returns:
        Number of stories in feed
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    articles = db.get_relevant_articles(limit=max_stories)

    # Build RSS XML
    rss_items = []
    for article in articles:
        pub_date = article.get('date_published') or article['date_scraped'][:10]
        item = f"""    <item>
      <title><![CDATA[{article['title']}]]></title>
      <link>{article['url']}</link>
      <guid isPermaLink="true">{article['url']}</guid>
      <pubDate>{pub_date}</pubDate>
      <description><![CDATA[{article.get('snippet', '')}]]></description>
      <source>{article.get('source', 'Unknown')}</source>
    </item>"""
        rss_items.append(item)

    rss_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{feed_title}</title>
    <link>{site_url}/ai-news/</link>
    <description>{feed_description}</description>
    <language>en-us</language>
    <lastBuildDate>{datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000")}</lastBuildDate>
    <atom:link href="{site_url}/data/ai-police-news.xml" rel="self" type="application/rss+xml"/>
{chr(10).join(rss_items)}
  </channel>
</rss>"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rss_content)

    logger.info(f"Generated RSS feed with {len(articles)} stories at {output_path}")
    return len(articles)
