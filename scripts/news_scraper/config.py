"""
Configuration loading for the news scraper.
"""

import os
from pathlib import Path
from typing import Any

import yaml


def load_config(config_path: str | Path | None = None) -> dict[str, Any]:
    """
    Load configuration from YAML file.

    Args:
        config_path: Path to config file. Defaults to config/news-sources.yaml

    Returns:
        Configuration dictionary
    """
    if config_path is None:
        # Find project root (where config/ directory is)
        current = Path(__file__).parent
        while current != current.parent:
            if (current / 'config' / 'news-sources.yaml').exists():
                config_path = current / 'config' / 'news-sources.yaml'
                break
            current = current.parent

        if config_path is None:
            raise FileNotFoundError("Could not find config/news-sources.yaml")

    config_path = Path(config_path)

    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    return config


def get_project_root() -> Path:
    """Get the project root directory."""
    current = Path(__file__).parent
    while current != current.parent:
        if (current / 'config').exists() and (current / 'static').exists():
            return current
        current = current.parent

    # Fallback to current working directory
    return Path.cwd()


def get_db_path() -> Path:
    """Get the database path."""
    return get_project_root() / 'assets' / 'db' / 'news_archive.db'


def get_output_json_path() -> Path:
    """Get the output JSON path."""
    return get_project_root() / 'static' / 'data' / 'ai-police-news.json'


def get_output_rss_path() -> Path:
    """Get the output RSS path."""
    return get_project_root() / 'static' / 'data' / 'ai-police-news.xml'


class ScraperConfig:
    """Configuration wrapper with typed access."""

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize config wrapper.

        Args:
            config: Config dict or None to load from file
        """
        self._config = config or load_config()

    @property
    def rss_feeds(self) -> list[dict]:
        """Get RSS feed configurations."""
        return self._config.get('rss_feeds', [])

    @property
    def search_terms(self) -> list[str]:
        """Get search terms for Google News."""
        return self._config.get('search_terms', [])

    @property
    def newsapi_enabled(self) -> bool:
        """Check if NewsAPI is enabled."""
        return self._config.get('newsapi', {}).get('enabled', False)

    @property
    def newsapi_days_back(self) -> int:
        """Get NewsAPI lookback period in days."""
        return self._config.get('newsapi', {}).get('days_back', 7)

    @property
    def min_relevance_score(self) -> float:
        """Get minimum relevance score threshold."""
        return self._config.get('filtering', {}).get('min_relevance_score', 0.3)

    @property
    def max_stories_json(self) -> int:
        """Get max stories for JSON output."""
        return self._config.get('output', {}).get('max_stories_json', 150)

    @property
    def max_stories_rss(self) -> int:
        """Get max stories for RSS output."""
        return self._config.get('output', {}).get('max_stories_rss', 50)

    @property
    def log_level(self) -> str:
        """Get logging level."""
        return self._config.get('logging', {}).get('level', 'INFO')

    def to_dict(self) -> dict:
        """Return raw config dict."""
        return self._config
