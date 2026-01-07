---
title: "In the Media"
summary: "Media coverage and interviews featuring Dr. Ian Adams on policing, technology, and criminal justice research"
date: 2026-01-06
type: page
reading_time: false
share: false
profile: false
comments: false
---

This page automatically tracks media coverage, interviews, and mentions of my research on policing, technology, and criminal justice. The feed aggregates stories where I've been quoted, cited, or featured as an expert source.

**Research Areas Covered:**
- Artificial intelligence in policing and report writing
- Body-worn cameras and police technology
- Use of force research and policy
- Police K9 deployments and outcomes
- Training and accountability


**Subscribe:** [RSS Feed](/data/media-mentions.xml). Feed began active tracking on January 6, 2026.

---

<link rel="stylesheet" href="/css/news-feed.css">

<div id="media-feed" class="news-feed-container">
  <div class="news-loading">
    <p>Loading media coverage...</p>
  </div>
</div>

<style>
/* News Feed Container */
.news-feed-container {
  margin-top: 2rem;
}

.news-loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted, #666);
}

/* Controls Bar */
.news-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--article-bg-color, #f8f9fa);
  border-radius: 8px;
  flex-wrap: wrap;
  gap: 1rem;
}

.news-stats {
  font-size: 0.95rem;
  color: var(--text-muted, #666);
}

.news-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--btn-default-border, #ddd);
  background: var(--btn-default-bg, white);
  color: var(--body-color, #333);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--btn-hover-bg, #e9ecef);
}

.filter-btn.active {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

/* Featured Section */
.featured-section {
  margin-bottom: 2rem;
}

.featured-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #0066cc;
}

.featured-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--heading-color, #1a1a1a);
}

.featured-icon {
  color: #f4c430;
  font-size: 1.2rem;
}

/* Card Grid Layout */
.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

@media (min-width: 1200px) {
  .news-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 767px) {
  .news-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

/* Individual Card Styling */
.news-card {
  display: flex;
  flex-direction: column;
  background: var(--article-bg-color, white);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  min-height: 180px;
}

.news-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.news-card.featured {
  border: 2px solid #f4c430;
  box-shadow: 0 2px 8px rgba(244, 196, 48, 0.2);
}

.news-card.featured:hover {
  box-shadow: 0 8px 24px rgba(244, 196, 48, 0.3);
}

.news-card:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

.news-card:focus:not(:focus-visible) {
  outline: none;
}

.news-card:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Card Header - Source */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--card-header-bg, #fafafa);
  border-bottom: 1px solid var(--border-color, #eee);
  font-size: 0.8rem;
  color: var(--text-muted, #666);
}

.dark .card-header {
  background: rgba(255, 255, 255, 0.05);
}

.card-source {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 500;
}

.source-icon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  background: var(--text-muted, #999);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  flex-shrink: 0;
}

/* Featured Badge */
.featured-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.4rem;
  background: #fff8dc;
  border: 1px solid #f4c430;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 600;
  color: #b8860b;
  text-transform: uppercase;
}

/* Confidence Badge */
.confidence-badge {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.confidence-high { background: #c8e6c9; color: #2e7d32; }
.confidence-medium { background: #fff9c4; color: #f9a825; }
.confidence-low { background: #ffcdd2; color: #c62828; }
.confidence-unknown { background: #e0e0e0; color: #666; }

/* Card Body - Headline */
.card-body {
  flex: 1;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 0.5rem 0;
  color: var(--heading-color, #1a1a1a);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-summary {
  font-size: 0.875rem;
  color: var(--text-muted, #666);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  flex: 1;
}

/* Topic Tags */
.card-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.topic-tag {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

/* Card Footer - Metadata */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color, #eee);
  font-size: 0.8rem;
  color: var(--text-muted, #666);
  gap: 0.75rem;
  flex-wrap: wrap;
}

.card-date {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.card-date::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'/%3E%3C/svg%3E");
  background-size: contain;
  opacity: 0.7;
}

/* Mention Type Badge */
.mention-type-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.mention-type-quoted { background: #e8f5e9; color: #2e7d32; }
.mention-type-cited { background: #e3f2fd; color: #1565c0; }
.mention-type-referenced { background: #f3e5f5; color: #7b1fa2; }
.mention-type-byline { background: #fff3e0; color: #ef6c00; }

/* Story Type Badge */
.story-type-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.story-type-news { background: #f5f5f5; color: #666; }
.story-type-research { background: #e8f5e9; color: #2e7d32; }
.story-type-interview { background: #e3f2fd; color: #1565c0; }
.story-type-opinion { background: #fff8e1; color: #ff8f00; }
.story-type-policy { background: #fce4ec; color: #ad1457; }
.story-type-feature { background: #ede7f6; color: #5e35b1; }

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
  padding: 1rem;
  flex-wrap: wrap;
}

.pagination-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color, #ddd);
  background: var(--btn-default-bg, white);
  color: var(--body-color, #333);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--btn-hover-bg, #e9ecef);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn.active {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--text-muted, #666);
  margin: 0 1rem;
}

/* No Stories Message */
.no-stories {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted, #999);
  font-size: 1.1rem;
  grid-column: 1 / -1;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .card-date::before {
    filter: invert(1);
  }
}

.dark .card-date::before {
  filter: invert(1);
}
</style>

<script src="/js/news-feed.js"></script>
<script>
// Media Mentions Feed Configuration
(function() {
  function renderMediaCard(story, isFeatured) {
    var mentionType = story.mention_type || 'referenced';
    var sourceInitial = (story.source || 'N')[0].toUpperCase();
    var confidence = story.relevance_confidence || 'unknown';

    // Build topics HTML
    var topicsHTML = '';
    if (story.topics && story.topics.length > 0) {
      topicsHTML = '<div class="card-topics">';
      var topics = Array.isArray(story.topics) ? story.topics : [story.topics];
      topics.slice(0, 3).forEach(function(topic) {
        topicsHTML += '<span class="topic-tag">' + escapeHtml(topic) + '</span>';
      });
      topicsHTML += '</div>';
    }

    var cardClass = 'news-card' + (isFeatured ? ' featured' : '');

    var html = '<article class="' + cardClass + '" role="listitem" tabindex="0" ' +
      'onclick="window.open(\'' + escapeHtml(story.url) + '\', \'_blank\', \'noopener\')" ' +
      'onkeydown="if(event.key===\'Enter\')window.open(\'' + escapeHtml(story.url) + '\', \'_blank\', \'noopener\')" ' +
      'aria-label="' + escapeHtml(story.title) + '">' +
      '<div class="card-header">' +
      '<div class="card-source">' +
      '<span class="source-icon" aria-hidden="true">' + sourceInitial + '</span>' +
      '<span>' + escapeHtml(story.source || 'Unknown') + '</span>' +
      '</div>';

    if (isFeatured) {
      html += '<span class="featured-badge">&#9733; Featured</span>';
    } else {
      html += '<span class="confidence-badge confidence-' + confidence + '">' + confidence + '</span>';
    }

    html += '</div>' +
      '<div class="card-body">' +
      '<h3 class="card-title">' + escapeHtml(story.title) + '</h3>' +
      '<p class="card-summary">' + escapeHtml(stripHtml(story.snippet || story.summary || '')) + '</p>' +
      topicsHTML +
      '</div>' +
      '<div class="card-footer">' +
      '<span class="card-date">' + formatDate(story.date || story.date_discovered) + '</span>' +
      '<span class="mention-type-badge mention-type-' + mentionType + '">' + capitalize(mentionType) + '</span>' +
      '</div>' +
      '</article>';

    return html;
  }

  // Helper functions
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  }

  function stripHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    var now = new Date();
    var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + ' days ago';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Initialize the feed
  new NewsFeed({
    containerId: 'media-feed',
    jsonPath: '/data/media-mentions.json',
    cardsPerPage: 12,
    filterField: 'mention_type',
    filterTypes: ['quoted', 'cited', 'referenced', 'byline'],
    dateField: 'date',
    prefix: 'media',
    renderCard: renderMediaCard,
    hasFeatured: true
  });
})();
</script>
