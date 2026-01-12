"""
Google News RSS feed source.
Fetches articles from Google News search RSS feeds.
"""

import time
import urllib.parse
from typing import Optional
import logging

import feedparser

from .base import BaseSource, Article

logger = logging.getLogger(__name__)


class GoogleNewsSource(BaseSource):
    """Fetch articles from Google News RSS feeds."""

    GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"

    @property
    def source_type(self) -> str:
        return "google_news"

    def fetch(self) -> list[Article]:
        """
        Fetch articles from Google News for all search terms.

        Returns:
            List of Article objects
        """
        articles = []
        search_terms = self.config.get('search_terms', [])

        # Also fetch from configured RSS feeds
        rss_feeds = self.config.get('rss_feeds', [])

        # Fetch Google News search results
        for term in search_terms:
            try:
                term_articles = self._fetch_search_term(term)
                articles.extend(term_articles)
                # Rate limiting
                time.sleep(1)
            except Exception as e:
                logger.error(f"Error fetching Google News for '{term}': {e}")

        # Fetch direct RSS feeds
        for feed in rss_feeds:
            try:
                feed_articles = self._fetch_rss_feed(
                    feed['url'],
                    feed.get('name', 'Unknown')
                )
                articles.extend(feed_articles)
                time.sleep(0.5)
            except Exception as e:
                logger.error(f"Error fetching RSS feed '{feed.get('name')}': {e}")

        logger.info(f"Fetched {len(articles)} articles from Google News and RSS feeds")
        return articles

    def _fetch_search_term(self, term: str) -> list[Article]:
        """Fetch articles for a single search term."""
        # Build Google News RSS URL
        params = {
            'q': term,
            'hl': 'en-US',
            'gl': 'US',
            'ceid': 'US:en'
        }
        url = f"{self.GOOGLE_NEWS_RSS_URL}?{urllib.parse.urlencode(params)}"

        feed = feedparser.parse(url)

        if feed.bozo:
            logger.warning(f"Feed parsing issue for '{term}': {feed.bozo_exception}")

        articles = []
        for entry in feed.entries:
            article = self._parse_entry(entry, term)
            if article:
                articles.append(article)

        logger.debug(f"Found {len(articles)} articles for search term: {term}")
        return articles

    def _fetch_rss_feed(self, url: str, source_name: str) -> list[Article]:
        """Fetch articles from a direct RSS feed URL."""
        feed = feedparser.parse(url)

        if feed.bozo:
            logger.warning(f"Feed parsing issue for '{source_name}': {feed.bozo_exception}")

        articles = []
        for entry in feed.entries:
            article = self._parse_rss_entry(entry, source_name)
            if article:
                articles.append(article)

        logger.debug(f"Found {len(articles)} articles from RSS feed: {source_name}")
        return articles

    def _parse_entry(self, entry: dict, search_query: str) -> Optional[Article]:
        """Parse a Google News RSS entry into an Article."""
        try:
            url = entry.get('link', '')
            title = entry.get('title', '')

            if not url or not title:
                return None

            # Extract source from title (Google News format: "Title - Source")
            source = "Google News"
            if ' - ' in title:
                parts = title.rsplit(' - ', 1)
                if len(parts) == 2:
                    title, source = parts

            # Get published date
            date_published = None
            if 'published' in entry:
                date_published = self._parse_date(entry['published'])
            elif 'updated' in entry:
                date_published = self._parse_date(entry['updated'])

            # Get snippet/summary
            snippet = entry.get('summary', entry.get('description', ''))

            return Article(
                url=url,
                title=title,
                source=source,
                snippet=snippet,
                date_published=date_published,
                source_type=self.source_type,
                search_query=search_query
            )
        except Exception as e:
            logger.warning(f"Error parsing entry: {e}")
            return None

    def _parse_rss_entry(self, entry: dict, source_name: str) -> Optional[Article]:
        """Parse a generic RSS entry into an Article."""
        try:
            url = entry.get('link', '')
            title = entry.get('title', '')

            if not url or not title:
                return None

            # Get published date
            date_published = None
            if 'published' in entry:
                date_published = self._parse_date(entry['published'])
            elif 'updated' in entry:
                date_published = self._parse_date(entry['updated'])

            # Get snippet/summary
            snippet = entry.get('summary', entry.get('description', ''))

            return Article(
                url=url,
                title=title,
                source=source_name,
                snippet=snippet,
                date_published=date_published,
                source_type="rss",
                search_query=None
            )
        except Exception as e:
            logger.warning(f"Error parsing RSS entry: {e}")
            return None
