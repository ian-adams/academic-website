---
title: "Research Watch: Force Science Institute News"
summary: "Automated news aggregator tracking the Force Science Institute's influence on police use-of-force testimony, legal proceedings, and policy"
date: 2026-01-06
type: page
reading_time: false
share: false
profile: false
comments: false
---

This page automatically tracks news, research, and developments related to the [Force Science Institute (FSI)](https://www.forcescience.com/), a private company that produces research on police use-of-force. The feed surfaces journalistic coverage, legal proceedings, academic critiques, and policy developments.

**About Force Science Institute:** FSI trains and certifies "Force Science Analysts" who frequently testify as expert witnesses in criminal and civil cases involving police shootings. FSI's research and concepts (such as "action beats reaction," "inattentional blindness," and "slip and capture") shape jury deliberations, prosecutorial decisions, and police training curricula. The organization's methodology has been criticized by academic experts and the Department of Justice.

Read "[Forced Science: A Critical Appraisal of the Scientific Rigor of 'Force Science' Policing Research](https://doi.org/10.1177/10986111251357498)" in *Police Quarterly* July, 2025

Read "[Training Officers to Shoot First, and He Will Answer Questions Later](https://www.nytimes.com/2015/08/02/us/training-officers-to-shoot-first-and-he-will-answer-questions-later.html)" via the *New York Times*, written by Matt Apuzzo (August 1, 2015).

**Feed includes:**
- Legal proceedings where FSI or FSI-affiliated experts testify
- Daubert/Frye challenges to FSI research or experts
- Prosecutorial decisions citing FSI analysis
- Academic critiques of FSI methodology
- Investigative journalism examining FSI's influence
- Policy developments involving FSI training
- International coverage of FSI influence

**Relevance Confidence Levels:**
- **High:** Explicit mention of Force Science Institute, Bill Lewinski, or certified analysts
- **Medium:** FSI-affiliated concepts or experts without explicit attribution
- **Low:** Contextual signals only; flagged for manual review

**Exclusions:** This feed attempts to exclude FSI's own promotional content and generic police training announcements.

**Subscribe:** [RSS Feed](/data/force-science-news.xml). Feed began active tracking on January 6, 2026.

---

<div id="force-science-feed" class="news-feed-container">
  <div class="news-loading">
    <p>Loading latest stories...</p>
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

/* Force Science specific story types */
.story-type-legal { background: #ffebee; color: #c62828; }
.story-type-daubert { background: #fce4ec; color: #ad1457; }
.story-type-academic { background: #e8f5e9; color: #2e7d32; }
.story-type-policy { background: #e3f2fd; color: #1565c0; }
.story-type-investigative { background: #fff3e0; color: #ef6c00; }
.story-type-prosecutorial { background: #f3e5f5; color: #7b1fa2; }
.story-type-international { background: #e0f7fa; color: #00838f; }
.story-type-opinion { background: #fff8e1; color: #ff8f00; }
.story-type-general { background: #f5f5f5; color: #666; }

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

<script>
// Force Science News Feed - Card Grid with Pagination
(function() {
  var CARDS_PER_PAGE = 12;
  var allStories = [];
  var filteredStories = [];
  var currentFilter = 'all';
  var currentPage = 1;

  // Fetch news data
  fetch('/data/force-science-news.json')
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to load: ' + response.status);
      return response.json();
    })
    .then(function(data) {
      allStories = data.stories || [];
      filteredStories = allStories;
      renderFeed();
    })
    .catch(function(error) {
      console.error('Error loading news:', error);
      document.getElementById('force-science-feed').innerHTML =
        '<div class="no-stories"><p>Unable to load news feed. Please try again later.</p></div>';
    });

  function renderFeed() {
    var container = document.getElementById('force-science-feed');

    if (filteredStories.length === 0) {
      container.innerHTML = '<div class="no-stories"><p>No stories found' +
        (currentFilter !== 'all' ? ' for this filter' : '') + '.</p></div>';
      return;
    }

    // Calculate pagination
    var totalPages = Math.ceil(filteredStories.length / CARDS_PER_PAGE);
    currentPage = Math.min(currentPage, totalPages);
    var startIdx = (currentPage - 1) * CARDS_PER_PAGE;
    var endIdx = startIdx + CARDS_PER_PAGE;
    var pageStories = filteredStories.slice(startIdx, endIdx);

    // Get story type counts
    var typeCounts = {};
    allStories.forEach(function(story) {
      var type = story.story_type || 'general';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Build controls HTML
    var controlsHTML = '<div class="news-controls">' +
      '<div class="news-stats"><strong>' + filteredStories.length + '</strong> stories found</div>' +
      '<div class="news-filters">' +
      '<button class="filter-btn ' + (currentFilter === 'all' ? 'active' : '') +
      '" onclick="fsFilterStories(\'all\')" aria-pressed="' + (currentFilter === 'all') + '">All (' + allStories.length + ')</button>';

    var types = ['legal', 'daubert', 'academic', 'policy', 'investigative', 'prosecutorial', 'international', 'opinion'];
    types.forEach(function(type) {
      if (typeCounts[type]) {
        controlsHTML += '<button class="filter-btn ' + (currentFilter === type ? 'active' : '') +
          '" onclick="fsFilterStories(\'' + type + '\')" aria-pressed="' + (currentFilter === type) + '">' +
          capitalize(type) + ' (' + typeCounts[type] + ')</button>';
      }
    });
    controlsHTML += '</div></div>';

    // Build card grid HTML
    var gridHTML = '<div class="news-grid" role="list">';
    pageStories.forEach(function(story) {
      var storyType = story.story_type || 'general';
      var sourceInitial = (story.source || 'N')[0].toUpperCase();
      var confidence = story.relevance_confidence || 'unknown';

      gridHTML += '<article class="news-card" role="listitem" tabindex="0" ' +
        'onclick="window.open(\'' + escapeHtml(story.url) + '\', \'_blank\', \'noopener\')" ' +
        'onkeydown="if(event.key===\'Enter\')window.open(\'' + escapeHtml(story.url) + '\', \'_blank\', \'noopener\')" ' +
        'aria-label="' + escapeHtml(story.title) + '">' +
        '<div class="card-header">' +
        '<div class="card-source">' +
        '<span class="source-icon" aria-hidden="true">' + sourceInitial + '</span>' +
        '<span>' + escapeHtml(story.source || 'Unknown') + '</span>' +
        '</div>' +
        '<span class="confidence-badge confidence-' + confidence + '">' + confidence + '</span>' +
        '</div>' +
        '<div class="card-body">' +
        '<h3 class="card-title">' + escapeHtml(story.title) + '</h3>' +
        '<p class="card-summary">' + escapeHtml(stripHtml(story.summary || '')) + '</p>' +
        '</div>' +
        '<div class="card-footer">' +
        '<span class="card-date">' + formatDate(story.date || story.date_discovered) + '</span>' +
        '<span class="story-type-badge story-type-' + storyType + '">' + capitalize(storyType) + '</span>' +
        '</div>' +
        '</article>';
    });
    gridHTML += '</div>';

    // Build pagination HTML
    var paginationHTML = '';
    if (totalPages > 1) {
      paginationHTML = '<nav class="pagination" aria-label="News pagination">' +
        '<button class="pagination-btn" onclick="fsGoToPage(' + (currentPage - 1) + ')" ' +
        (currentPage === 1 ? 'disabled' : '') + ' aria-label="Previous page">&laquo; Prev</button>';

      // Page numbers
      var startPage = Math.max(1, currentPage - 2);
      var endPage = Math.min(totalPages, startPage + 4);
      startPage = Math.max(1, endPage - 4);

      if (startPage > 1) {
        paginationHTML += '<button class="pagination-btn" onclick="fsGoToPage(1)">1</button>';
        if (startPage > 2) paginationHTML += '<span class="pagination-info">...</span>';
      }

      for (var i = startPage; i <= endPage; i++) {
        paginationHTML += '<button class="pagination-btn ' + (i === currentPage ? 'active' : '') +
          '" onclick="fsGoToPage(' + i + ')" aria-current="' + (i === currentPage ? 'page' : 'false') + '">' + i + '</button>';
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationHTML += '<span class="pagination-info">...</span>';
        paginationHTML += '<button class="pagination-btn" onclick="fsGoToPage(' + totalPages + ')">' + totalPages + '</button>';
      }

      paginationHTML += '<button class="pagination-btn" onclick="fsGoToPage(' + (currentPage + 1) + ')" ' +
        (currentPage === totalPages ? 'disabled' : '') + ' aria-label="Next page">Next &raquo;</button>' +
        '</nav>';
    }

    container.innerHTML = controlsHTML + gridHTML + paginationHTML;
  }

  // Global functions for event handlers
  window.fsFilterStories = function(type) {
    currentFilter = type;
    currentPage = 1;
    if (type === 'all') {
      filteredStories = allStories;
    } else {
      filteredStories = allStories.filter(function(story) { return story.story_type === type; });
    }
    renderFeed();
    document.getElementById('force-science-feed').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.fsGoToPage = function(page) {
    var totalPages = Math.ceil(filteredStories.length / CARDS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderFeed();
    document.getElementById('force-science-feed').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
})();
</script>
