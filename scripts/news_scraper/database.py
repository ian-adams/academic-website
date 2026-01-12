"""
SQLite database operations for the news scraper.
Handles article storage, deduplication, and queries.
"""

import sqlite3
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass


@dataclass
class ArticleRecord:
    """Database record for an article."""
    url_hash: str
    url: str
    title: str
    source: str
    date_published: Optional[str]
    date_scraped: str
    snippet: Optional[str]
    is_relevant: Optional[int]  # None=unclassified, 0=irrelevant, 1=relevant
    relevance_reason: Optional[str]
    classification_model: Optional[str]
    classification_date: Optional[str]
    source_type: str
    search_query: Optional[str]
    story_type: Optional[str]
    relevance_score: Optional[float]
    key_entities: Optional[str]
    location: Optional[str]
    tags: Optional[str]
    # New fields for Force Science multi-label classification
    article_label: Optional[str] = None  # DIRECT, PROXY, ADJACENT, NO
    label_confidence: Optional[float] = None  # 0.0 to 1.0
    label_relevance: Optional[int] = None  # 0 to 100
    signals: Optional[str] = None  # JSON array of matched signals
    entities_extracted: Optional[str] = None  # JSON array of entities
    rationale: Optional[str] = None  # One-sentence explanation
    stage1_diagnostics: Optional[str] = None  # JSON object with Stage 1 audit info


class NewsDatabase:
    """SQLite database for storing news articles."""

    # Base schema for new databases (without label columns - those are added via migration)
    SCHEMA_BASE = """
    CREATE TABLE IF NOT EXISTS articles (
        url_hash TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        source TEXT,
        date_published TEXT,
        date_scraped TEXT NOT NULL,
        snippet TEXT,

        is_relevant INTEGER DEFAULT NULL,
        relevance_reason TEXT,
        classification_model TEXT,
        classification_date TEXT,

        source_type TEXT,
        search_query TEXT,

        story_type TEXT,
        relevance_score REAL,
        key_entities TEXT,
        location TEXT,
        tags TEXT,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_url ON articles(url);
    CREATE INDEX IF NOT EXISTS idx_date_published ON articles(date_published DESC);
    CREATE INDEX IF NOT EXISTS idx_is_relevant ON articles(is_relevant);
    CREATE INDEX IF NOT EXISTS idx_date_scraped ON articles(date_scraped DESC);
    CREATE INDEX IF NOT EXISTS idx_source_type ON articles(source_type);
    """

    # Columns to add for Force Science multi-label classification
    LABEL_COLUMNS = [
        ("article_label", "TEXT"),
        ("label_confidence", "REAL"),
        ("label_relevance", "INTEGER"),
        ("signals", "TEXT"),
        ("entities_extracted", "TEXT"),
        ("rationale", "TEXT"),
        ("stage1_diagnostics", "TEXT"),
    ]

    def __init__(self, db_path: str | Path):
        """Initialize database connection."""
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        """Create tables and indices if they don't exist."""
        # First create base table structure
        self.conn.executescript(self.SCHEMA_BASE)
        self.conn.commit()

        # Then apply migrations to add label columns (for existing databases)
        self._apply_migrations()

        # Finally create indices for label columns (after columns exist)
        self._create_label_indices()

    def _apply_migrations(self):
        """Apply schema migrations for existing databases."""
        # Check which columns exist
        cursor = self.conn.execute("PRAGMA table_info(articles)")
        existing_columns = {row[1] for row in cursor.fetchall()}

        # Add any missing label columns
        for col_name, col_type in self.LABEL_COLUMNS:
            if col_name not in existing_columns:
                try:
                    self.conn.execute(f"ALTER TABLE articles ADD COLUMN {col_name} {col_type}")
                except sqlite3.OperationalError as e:
                    # Column might already exist (race condition)
                    if "duplicate column" not in str(e).lower():
                        raise
        self.conn.commit()

    def _create_label_indices(self):
        """Create indices for label columns (called after columns exist)."""
        try:
            self.conn.execute("CREATE INDEX IF NOT EXISTS idx_article_label ON articles(article_label)")
            self.conn.execute("CREATE INDEX IF NOT EXISTS idx_label_relevance ON articles(label_relevance DESC)")
            self.conn.commit()
        except sqlite3.OperationalError:
            # Index creation might fail if columns don't exist - that's ok
            pass

    @staticmethod
    def hash_url(url: str) -> str:
        """Generate MD5 hash of normalized URL for deduplication."""
        # Normalize URL: lowercase, strip trailing slash
        normalized = url.lower().rstrip('/')
        return hashlib.md5(normalized.encode()).hexdigest()

    def url_exists(self, url: str) -> bool:
        """Check if URL already exists in database."""
        url_hash = self.hash_url(url)
        cursor = self.conn.execute(
            "SELECT 1 FROM articles WHERE url_hash = ?",
            (url_hash,)
        )
        return cursor.fetchone() is not None

    def get_existing_hashes(self) -> set[str]:
        """Get all existing URL hashes for batch deduplication."""
        cursor = self.conn.execute("SELECT url_hash FROM articles")
        return {row['url_hash'] for row in cursor.fetchall()}

    def insert_article(self, article: ArticleRecord) -> bool:
        """
        Insert a new article into the database.
        Returns True if inserted, False if duplicate.
        """
        try:
            self.conn.execute("""
                INSERT INTO articles (
                    url_hash, url, title, source, date_published, date_scraped,
                    snippet, is_relevant, relevance_reason, classification_model,
                    classification_date, source_type, search_query, story_type,
                    relevance_score, key_entities, location, tags,
                    article_label, label_confidence, label_relevance, signals,
                    entities_extracted, rationale, stage1_diagnostics
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                article.url_hash, article.url, article.title, article.source,
                article.date_published, article.date_scraped, article.snippet,
                article.is_relevant, article.relevance_reason,
                article.classification_model, article.classification_date,
                article.source_type, article.search_query, article.story_type,
                article.relevance_score, article.key_entities, article.location,
                article.tags, article.article_label, article.label_confidence,
                article.label_relevance, article.signals, article.entities_extracted,
                article.rationale, article.stage1_diagnostics
            ))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def bulk_insert_articles(self, articles: list[ArticleRecord]) -> int:
        """
        Insert multiple articles at once.
        Returns count of successfully inserted articles.
        """
        inserted = 0
        for article in articles:
            if self.insert_article(article):
                inserted += 1
        return inserted

    def update_classification(
        self,
        url_hash: str,
        is_relevant: int,
        relevance_reason: Optional[str] = None,
        model: Optional[str] = None
    ):
        """Update article classification after LLM review."""
        self.conn.execute("""
            UPDATE articles
            SET is_relevant = ?,
                relevance_reason = ?,
                classification_model = ?,
                classification_date = ?,
                updated_at = ?
            WHERE url_hash = ?
        """, (
            is_relevant,
            relevance_reason,
            model,
            datetime.utcnow().isoformat() + "Z",
            datetime.utcnow().isoformat() + "Z",
            url_hash
        ))
        self.conn.commit()

    def get_unclassified_articles(self, limit: int = 100) -> list[dict]:
        """Get articles that haven't been classified yet."""
        cursor = self.conn.execute("""
            SELECT url_hash, url, title, source, snippet
            FROM articles
            WHERE is_relevant IS NULL
            ORDER BY date_scraped DESC
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]

    def get_relevant_articles(self, limit: int | None = None) -> list[dict]:
        """Get relevant articles for JSON export."""
        if limit:
            cursor = self.conn.execute("""
                SELECT *
                FROM articles
                WHERE is_relevant = 1
                ORDER BY date_published DESC, date_scraped DESC
                LIMIT ?
            """, (limit,))
        else:
            cursor = self.conn.execute("""
                SELECT *
                FROM articles
                WHERE is_relevant = 1
                ORDER BY date_published DESC, date_scraped DESC
            """)
        return [dict(row) for row in cursor.fetchall()]

    def get_all_articles(self) -> list[dict]:
        """Get all articles (for debugging/export)."""
        cursor = self.conn.execute("""
            SELECT * FROM articles
            ORDER BY date_published DESC, date_scraped DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

    def get_stats(self) -> dict:
        """Get database statistics."""
        cursor = self.conn.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_relevant = 1 THEN 1 ELSE 0 END) as relevant,
                SUM(CASE WHEN is_relevant = 0 THEN 1 ELSE 0 END) as irrelevant,
                SUM(CASE WHEN is_relevant IS NULL THEN 1 ELSE 0 END) as unclassified,
                SUM(CASE WHEN article_label = 'DIRECT' THEN 1 ELSE 0 END) as label_direct,
                SUM(CASE WHEN article_label = 'PROXY' THEN 1 ELSE 0 END) as label_proxy,
                SUM(CASE WHEN article_label = 'ADJACENT' THEN 1 ELSE 0 END) as label_adjacent,
                SUM(CASE WHEN article_label = 'NO' THEN 1 ELSE 0 END) as label_no
            FROM articles
        """)
        row = cursor.fetchone()
        return dict(row)

    def get_articles_by_label(
        self,
        labels: list[str],
        limit: int | None = None,
        min_confidence: float = 0.0,
        min_relevance: int = 0
    ) -> list[dict]:
        """
        Get articles by label(s) for export.

        Args:
            labels: List of labels to include (e.g., ['DIRECT', 'PROXY'])
            limit: Maximum number of articles
            min_confidence: Minimum confidence threshold
            min_relevance: Minimum relevance score threshold

        Returns:
            List of article dicts sorted by label_relevance desc, then date
        """
        placeholders = ','.join('?' * len(labels))
        query = f"""
            SELECT *
            FROM articles
            WHERE article_label IN ({placeholders})
              AND (label_confidence IS NULL OR label_confidence >= ?)
              AND (label_relevance IS NULL OR label_relevance >= ?)
            ORDER BY label_relevance DESC, date_published DESC, date_scraped DESC
        """
        params = list(labels) + [min_confidence, min_relevance]

        if limit:
            query += " LIMIT ?"
            params.append(limit)

        cursor = self.conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    def get_primary_feed_articles(self, limit: int | None = None) -> list[dict]:
        """
        Get DIRECT + PROXY articles for primary feed.
        Sorted by label_relevance desc, then recency.
        """
        return self.get_articles_by_label(['DIRECT', 'PROXY'], limit=limit)

    def get_adjacent_feed_articles(self, limit: int | None = None) -> list[dict]:
        """
        Get ADJACENT articles for secondary feed.
        Sorted by label_relevance desc, then recency.
        """
        return self.get_articles_by_label(['ADJACENT'], limit=limit)

    def get_alertable_articles(
        self,
        direct_proxy_threshold: float = 0.60,
        adjacent_threshold: float = 0.80,
        adjacent_relevance_min: int = 60
    ) -> dict:
        """
        Get articles that should trigger alerts.

        Returns:
            Dict with 'immediate' (DIRECT/PROXY above threshold) and
            'digest' (ADJACENT above thresholds) article lists.
        """
        # Immediate alerts: DIRECT/PROXY with confidence >= threshold
        cursor = self.conn.execute("""
            SELECT *
            FROM articles
            WHERE article_label IN ('DIRECT', 'PROXY')
              AND label_confidence >= ?
            ORDER BY label_relevance DESC, date_published DESC
        """, (direct_proxy_threshold,))
        immediate = [dict(row) for row in cursor.fetchall()]

        # Digest alerts: ADJACENT with high confidence and relevance
        cursor = self.conn.execute("""
            SELECT *
            FROM articles
            WHERE article_label = 'ADJACENT'
              AND label_confidence >= ?
              AND label_relevance >= ?
            ORDER BY label_relevance DESC, date_published DESC
        """, (adjacent_threshold, adjacent_relevance_min))
        digest = [dict(row) for row in cursor.fetchall()]

        return {'immediate': immediate, 'digest': digest}

    def close(self):
        """Close database connection."""
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
