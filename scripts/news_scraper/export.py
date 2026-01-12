"""
Export module - generates Hugo-compatible JSON from database.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from .database import NewsDatabase
from .classifier import ArticleClassifier

logger = logging.getLogger(__name__)


def export_to_json(
    db: NewsDatabase,
    output_path: str | Path,
    max_stories: int = 150
) -> int:
    """
    Export relevant articles to Hugo-compatible JSON.

    Args:
        db: NewsDatabase instance
        output_path: Path to output JSON file
        max_stories: Maximum number of stories to include

    Returns:
        Number of stories exported
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Get relevant articles from database
    articles = db.get_relevant_articles(limit=max_stories)

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
