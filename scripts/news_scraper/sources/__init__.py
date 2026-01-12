# News sources package
from .base import BaseSource, Article
from .google_news import GoogleNewsSource
from .newsapi import NewsAPISource

__all__ = ['BaseSource', 'Article', 'GoogleNewsSource', 'NewsAPISource']
