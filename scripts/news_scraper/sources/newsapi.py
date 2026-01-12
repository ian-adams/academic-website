"""
NewsAPI.org source.
Fetches articles from NewsAPI headlines and everything endpoints.
"""

import os
import time
from datetime import datetime, timedelta
from typing import Optional
import logging

import requests

from .base import BaseSource, Article

logger = logging.getLogger(__name__)


class NewsAPISource(BaseSource):
    """Fetch articles from NewsAPI.org."""

    BASE_URL = "https://newsapi.org/v2"

    def __init__(self, config: dict, api_key: Optional[str] = None):
        """
        Initialize NewsAPI source.

        Args:
            config: Configuration dictionary
            api_key: NewsAPI key (defaults to NEWSAPI_KEY env var)
        """
        super().__init__(config)
        self.api_key = api_key or os.environ.get('NEWSAPI_KEY')

        if not self.api_key:
            logger.warning("No NewsAPI key provided. NewsAPI source will be disabled.")

    @property
    def source_type(self) -> str:
        return "newsapi"

    def fetch(self) -> list[Article]:
        """
        Fetch articles from NewsAPI.

        Returns:
            List of Article objects
        """
        if not self.api_key:
            logger.info("NewsAPI disabled (no API key)")
            return []

        newsapi_config = self.config.get('newsapi', {})
        if not newsapi_config.get('enabled', False):
            logger.info("NewsAPI disabled in config")
            return []

        articles = []
        search_terms = self.config.get('search_terms', [])
        days_back = newsapi_config.get('days_back', 7)

        # Calculate date range
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=days_back)

        # Fetch for each search term
        for term in search_terms:
            try:
                term_articles = self._fetch_everything(
                    term,
                    from_date.strftime('%Y-%m-%d'),
                    to_date.strftime('%Y-%m-%d')
                )
                articles.extend(term_articles)
                # Rate limiting - NewsAPI free tier has limits
                time.sleep(0.5)
            except Exception as e:
                logger.error(f"Error fetching NewsAPI for '{term}': {e}")

        logger.info(f"Fetched {len(articles)} articles from NewsAPI")
        return articles

    def _fetch_everything(
        self,
        query: str,
        from_date: str,
        to_date: str
    ) -> list[Article]:
        """Fetch from NewsAPI /everything endpoint."""
        url = f"{self.BASE_URL}/everything"

        params = {
            'q': query,
            'from': from_date,
            'to': to_date,
            'language': 'en',
            'sortBy': 'publishedAt',
            'pageSize': 100,
            'apiKey': self.api_key
        }

        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            if data.get('status') != 'ok':
                logger.warning(f"NewsAPI error: {data.get('message', 'Unknown error')}")
                return []

            articles = []
            for item in data.get('articles', []):
                article = self._parse_article(item, query)
                if article:
                    articles.append(article)

            logger.debug(f"Found {len(articles)} articles for query: {query}")
            return articles

        except requests.exceptions.RequestException as e:
            logger.error(f"NewsAPI request failed: {e}")
            return []

    def _parse_article(self, item: dict, search_query: str) -> Optional[Article]:
        """Parse a NewsAPI article into an Article object."""
        try:
            url = item.get('url', '')
            title = item.get('title', '')

            if not url or not title:
                return None

            # Skip removed articles
            if title == '[Removed]':
                return None

            # Get source name
            source = item.get('source', {}).get('name', 'Unknown')

            # Get published date
            date_published = None
            if 'publishedAt' in item:
                date_published = self._parse_date(item['publishedAt'])

            # Get description
            snippet = item.get('description', '')

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
            logger.warning(f"Error parsing NewsAPI article: {e}")
            return None
