"""
Base class for news sources.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class Article:
    """Represents a news article from any source."""
    url: str
    title: str
    source: str
    snippet: Optional[str] = None
    date_published: Optional[str] = None
    source_type: str = "unknown"
    search_query: Optional[str] = None

    def __post_init__(self):
        # Clean up HTML entities in title and snippet
        if self.title:
            self.title = self._clean_html(self.title)
        if self.snippet:
            self.snippet = self._clean_html(self.snippet)

    @staticmethod
    def _clean_html(text: str) -> str:
        """Remove common HTML entities and clean text."""
        replacements = {
            '&nbsp;': ' ',
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '\u200b': '',  # Zero-width space
            '\xa0': ' ',   # Non-breaking space
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
        # Collapse multiple spaces
        return ' '.join(text.split())


class BaseSource(ABC):
    """Abstract base class for news sources."""

    def __init__(self, config: dict):
        """
        Initialize the source.

        Args:
            config: Configuration dictionary from news-sources.yaml
        """
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def fetch(self) -> list[Article]:
        """
        Fetch articles from the source.

        Returns:
            List of Article objects
        """
        pass

    @property
    @abstractmethod
    def source_type(self) -> str:
        """Return the source type identifier (e.g., 'google_news', 'newsapi')."""
        pass

    def _parse_date(self, date_str: Optional[str]) -> Optional[str]:
        """
        Parse various date formats into ISO 8601 (YYYY-MM-DD).

        Returns None if parsing fails.
        """
        if not date_str:
            return None

        # Common date formats to try
        formats = [
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%a, %d %b %Y %H:%M:%S %z',
            '%a, %d %b %Y %H:%M:%S %Z',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
            '%B %d, %Y',
            '%b %d, %Y',
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue

        # Try dateutil as fallback
        try:
            from dateutil import parser
            dt = parser.parse(date_str)
            return dt.strftime('%Y-%m-%d')
        except Exception:
            self.logger.warning(f"Could not parse date: {date_str}")
            return None
