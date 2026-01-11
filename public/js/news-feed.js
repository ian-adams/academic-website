/**
 * News Feed - Shared functionality for search, sort, and filter
 * Used across all aggregator pages (K9, AI, Force Science, Media)
 */

function NewsFeed(config) {
  // Configuration with defaults
  this.containerId = config.containerId;
  this.jsonPath = config.jsonPath;
  this.cardsPerPage = config.cardsPerPage || 12;
  this.filterField = config.filterField || 'story_type'; // or 'mention_type'
  this.filterTypes = config.filterTypes || [];
  this.dateField = config.dateField || 'date';
  this.prefix = config.prefix || 'feed';
  this.renderCard = config.renderCard; // Custom card render function
  this.hasFeatured = config.hasFeatured || false;

  // State
  this.allStories = [];
  this.filteredStories = [];
  this.currentPage = 1;
  this.currentTypeFilter = 'all';
  this.currentSearchQuery = '';
  this.currentSort = 'date-desc';
  this.selectedSources = [];
  this.selectedYears = [];
  this.searchTimeout = null;

  // Initialize
  this.init();
}

NewsFeed.prototype.init = function() {
  var self = this;

  // Fetch data
  fetch(this.jsonPath)
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to load: ' + response.status);
      return response.json();
    })
    .then(function(data) {
      self.allStories = data.stories || [];
      self.filteredStories = self.allStories.slice();
      self.render();
    })
    .catch(function(error) {
      console.error('Error loading news:', error);
      document.getElementById(self.containerId).innerHTML =
        '<div class="no-stories"><p>Unable to load feed. Please try again later.</p></div>';
    });

  // Expose global functions for event handlers
  var prefix = this.prefix;
  window[prefix + 'Search'] = function(query) { self.handleSearch(query); };
  window[prefix + 'ClearSearch'] = function() { self.clearSearch(); };
  window[prefix + 'Sort'] = function(sortBy) { self.handleSort(sortBy); };
  window[prefix + 'FilterType'] = function(type) { self.handleTypeFilter(type); };
  window[prefix + 'ToggleSource'] = function(source) { self.toggleSourceFilter(source); };
  window[prefix + 'ToggleYear'] = function(year) { self.toggleYearFilter(year); };
  window[prefix + 'ClearFilters'] = function() { self.clearAllFilters(); };
  window[prefix + 'RemoveFilter'] = function(type, value) { self.removeFilter(type, value); };
  window[prefix + 'GoToPage'] = function(page) { self.goToPage(page); };
};

NewsFeed.prototype.handleSearch = function(query) {
  var self = this;

  // Debounce search input
  if (this.searchTimeout) {
    clearTimeout(this.searchTimeout);
  }

  this.searchTimeout = setTimeout(function() {
    self.currentSearchQuery = query.toLowerCase().trim();
    self.currentPage = 1;
    self.applyFilters();
    self.render();
  }, 300);
};

NewsFeed.prototype.clearSearch = function() {
  this.currentSearchQuery = '';
  this.currentPage = 1;
  var searchInput = document.getElementById(this.prefix + '-search-input');
  if (searchInput) searchInput.value = '';
  this.applyFilters();
  this.render();
};

NewsFeed.prototype.handleSort = function(sortBy) {
  this.currentSort = sortBy;
  this.currentPage = 1;
  this.applyFilters();
  this.render();
};

NewsFeed.prototype.handleTypeFilter = function(type) {
  this.currentTypeFilter = type;
  this.currentPage = 1;
  this.applyFilters();
  this.render();
  this.scrollToTop();
};

NewsFeed.prototype.toggleSourceFilter = function(source) {
  var idx = this.selectedSources.indexOf(source);
  if (idx === -1) {
    this.selectedSources.push(source);
  } else {
    this.selectedSources.splice(idx, 1);
  }
  this.currentPage = 1;
  this.applyFilters();
  this.render();
};

NewsFeed.prototype.toggleYearFilter = function(year) {
  var idx = this.selectedYears.indexOf(year);
  if (idx === -1) {
    this.selectedYears.push(year);
  } else {
    this.selectedYears.splice(idx, 1);
  }
  this.currentPage = 1;
  this.applyFilters();
  this.render();
};

NewsFeed.prototype.removeFilter = function(type, value) {
  if (type === 'search') {
    this.clearSearch();
    return;
  }
  if (type === 'type') {
    this.currentTypeFilter = 'all';
  } else if (type === 'source') {
    var idx = this.selectedSources.indexOf(value);
    if (idx !== -1) this.selectedSources.splice(idx, 1);
  } else if (type === 'year') {
    var idx = this.selectedYears.indexOf(value);
    if (idx !== -1) this.selectedYears.splice(idx, 1);
  }
  this.currentPage = 1;
  this.applyFilters();
  this.render();
};

NewsFeed.prototype.clearAllFilters = function() {
  this.currentSearchQuery = '';
  this.currentTypeFilter = 'all';
  this.selectedSources = [];
  this.selectedYears = [];
  this.currentPage = 1;
  var searchInput = document.getElementById(this.prefix + '-search-input');
  if (searchInput) searchInput.value = '';
  this.applyFilters();
  this.render();
};

NewsFeed.prototype.applyFilters = function() {
  var self = this;
  var stories = this.allStories.slice();

  // Apply type filter
  if (this.currentTypeFilter !== 'all') {
    stories = stories.filter(function(story) {
      return story[self.filterField] === self.currentTypeFilter;
    });
  }

  // Apply source filter
  if (this.selectedSources.length > 0) {
    stories = stories.filter(function(story) {
      return self.selectedSources.indexOf(story.source) !== -1;
    });
  }

  // Apply year filter
  if (this.selectedYears.length > 0) {
    stories = stories.filter(function(story) {
      var date = story[self.dateField] || story.date_discovered;
      if (!date) return false;
      var year = new Date(date).getFullYear().toString();
      return self.selectedYears.indexOf(year) !== -1;
    });
  }

  // Apply search filter
  if (this.currentSearchQuery) {
    var query = this.currentSearchQuery;
    stories = stories.filter(function(story) {
      var title = (story.title || '').toLowerCase();
      var source = (story.source || '').toLowerCase();
      var summary = (story.summary || story.snippet || '').toLowerCase();
      return title.indexOf(query) !== -1 ||
             source.indexOf(query) !== -1 ||
             summary.indexOf(query) !== -1;
    });
  }

  // Apply sorting
  stories = this.sortStories(stories);

  this.filteredStories = stories;
};

NewsFeed.prototype.sortStories = function(stories) {
  var self = this;
  var sorted = stories.slice();

  switch (this.currentSort) {
    case 'date-desc':
      sorted.sort(function(a, b) {
        var dateA = new Date(a[self.dateField] || a.date_discovered || 0);
        var dateB = new Date(b[self.dateField] || b.date_discovered || 0);
        return dateB - dateA;
      });
      break;
    case 'date-asc':
      sorted.sort(function(a, b) {
        var dateA = new Date(a[self.dateField] || a.date_discovered || 0);
        var dateB = new Date(b[self.dateField] || b.date_discovered || 0);
        return dateA - dateB;
      });
      break;
    case 'source-asc':
      sorted.sort(function(a, b) {
        return (a.source || '').localeCompare(b.source || '');
      });
      break;
    case 'source-desc':
      sorted.sort(function(a, b) {
        return (b.source || '').localeCompare(a.source || '');
      });
      break;
  }

  return sorted;
};

NewsFeed.prototype.getUniqueSources = function() {
  var sources = {};
  this.allStories.forEach(function(story) {
    var source = story.source || 'Unknown';
    sources[source] = (sources[source] || 0) + 1;
  });
  return Object.keys(sources).sort().map(function(source) {
    return { name: source, count: sources[source] };
  });
};

NewsFeed.prototype.getUniqueYears = function() {
  var self = this;
  var years = {};
  this.allStories.forEach(function(story) {
    var date = story[self.dateField] || story.date_discovered;
    if (date) {
      var year = new Date(date).getFullYear().toString();
      years[year] = (years[year] || 0) + 1;
    }
  });
  return Object.keys(years).sort().reverse().map(function(year) {
    return { year: year, count: years[year] };
  });
};

NewsFeed.prototype.getTypeCounts = function() {
  var self = this;
  var counts = {};
  this.allStories.forEach(function(story) {
    var type = story[self.filterField] || 'general';
    counts[type] = (counts[type] || 0) + 1;
  });
  return counts;
};

NewsFeed.prototype.hasActiveFilters = function() {
  return this.currentSearchQuery ||
         this.currentTypeFilter !== 'all' ||
         this.selectedSources.length > 0 ||
         this.selectedYears.length > 0;
};

NewsFeed.prototype.render = function() {
  var container = document.getElementById(this.containerId);
  var self = this;

  // Build search and sort controls
  var html = this.buildSearchSortHTML();

  // Build filter controls (source and year)
  html += this.buildFilterControlsHTML();

  // Build active filters chips
  html += this.buildActiveFiltersHTML();

  // Build type filter buttons (existing functionality)
  html += this.buildTypeFilterHTML();

  if (this.filteredStories.length === 0) {
    html += '<div class="no-stories">' +
      '<p>No stories match your search.</p>' +
      '<p style="font-size: 0.9rem; margin-top: 0.5rem;">Try different keywords or clear filters.</p>' +
      '<button class="filter-btn" onclick="' + this.prefix + 'ClearFilters()" style="margin-top: 1rem;">Clear all filters</button>' +
      '</div>';
    container.innerHTML = html;
    return;
  }

  // Handle featured stories separately for media mentions
  var featuredStories = [];
  var regularStories = this.filteredStories;

  if (this.hasFeatured) {
    featuredStories = this.filteredStories.filter(function(s) { return s.featured === 1; });
    regularStories = this.filteredStories.filter(function(s) { return s.featured !== 1; });
  }

  // Pagination
  var totalPages = Math.ceil(regularStories.length / this.cardsPerPage);
  this.currentPage = Math.min(this.currentPage, Math.max(totalPages, 1));
  var startIdx = (this.currentPage - 1) * this.cardsPerPage;
  var endIdx = startIdx + this.cardsPerPage;
  var pageStories = regularStories.slice(startIdx, endIdx);

  // Build featured section (if applicable and on first page)
  if (this.hasFeatured && featuredStories.length > 0 && this.currentPage === 1 && !this.hasActiveFilters()) {
    html += '<div class="featured-section">' +
      '<div class="featured-header"><span class="featured-icon">&#9733;</span><h3>Featured Coverage</h3></div>' +
      '<div class="news-grid" role="list">';
    featuredStories.forEach(function(story) {
      html += self.renderCard(story, true);
    });
    html += '</div></div>';
  }

  // Build card grid
  html += '<div class="news-grid" role="list">';
  pageStories.forEach(function(story) {
    html += self.renderCard(story, false);
  });
  html += '</div>';

  // Build pagination
  html += this.buildPaginationHTML(totalPages);

  container.innerHTML = html;
};

NewsFeed.prototype.buildSearchSortHTML = function() {
  var prefix = this.prefix;

  return '<div class="search-sort-bar">' +
    '<div class="search-container">' +
    '<input type="text" id="' + prefix + '-search-input" class="search-input" ' +
    'placeholder="Search stories..." ' +
    'oninput="' + prefix + 'Search(this.value)" ' +
    'value="' + this.escapeHtml(this.currentSearchQuery) + '" ' +
    'aria-label="Search stories">' +
    (this.currentSearchQuery ?
      '<button class="search-clear" onclick="' + prefix + 'ClearSearch()" aria-label="Clear search">&times;</button>' : '') +
    '</div>' +
    '<div class="sort-container">' +
    '<label for="' + prefix + '-sort">Sort by:</label>' +
    '<select id="' + prefix + '-sort" class="sort-select" onchange="' + prefix + 'Sort(this.value)">' +
    '<option value="date-desc"' + (this.currentSort === 'date-desc' ? ' selected' : '') + '>Newest first</option>' +
    '<option value="date-asc"' + (this.currentSort === 'date-asc' ? ' selected' : '') + '>Oldest first</option>' +
    '<option value="source-asc"' + (this.currentSort === 'source-asc' ? ' selected' : '') + '>Source (A-Z)</option>' +
    '<option value="source-desc"' + (this.currentSort === 'source-desc' ? ' selected' : '') + '>Source (Z-A)</option>' +
    '</select>' +
    '</div>' +
    '</div>';
};

NewsFeed.prototype.buildFilterControlsHTML = function() {
  var sources = this.getUniqueSources();
  var years = this.getUniqueYears();
  var prefix = this.prefix;
  var self = this;
  var html = '';

  // Only show filters if there are enough options
  if (sources.length < 3 && years.length < 2) {
    return '';
  }

  html = '<div class="filter-controls">';

  // Source filter (only if 3+ sources)
  if (sources.length >= 3) {
    html += '<div class="filter-group">' +
      '<span class="filter-label">Source:</span>' +
      '<div class="filter-options">';

    // Show top sources as pills (limit to 8)
    sources.slice(0, 8).forEach(function(source) {
      var isSelected = self.selectedSources.indexOf(source.name) !== -1;
      html += '<button class="filter-pill' + (isSelected ? ' active' : '') + '" ' +
        'onclick="' + prefix + 'ToggleSource(\'' + self.escapeHtml(source.name).replace(/'/g, "\\'") + '\')">' +
        self.escapeHtml(source.name) + ' (' + source.count + ')' +
        '</button>';
    });

    html += '</div></div>';
  }

  // Year filter (only if 2+ years)
  if (years.length >= 2) {
    html += '<div class="filter-group">' +
      '<span class="filter-label">Year:</span>' +
      '<div class="filter-options">';

    years.forEach(function(yearObj) {
      var isSelected = self.selectedYears.indexOf(yearObj.year) !== -1;
      html += '<button class="filter-pill' + (isSelected ? ' active' : '') + '" ' +
        'onclick="' + prefix + 'ToggleYear(\'' + yearObj.year + '\')">' +
        yearObj.year + ' (' + yearObj.count + ')' +
        '</button>';
    });

    html += '</div></div>';
  }

  html += '</div>';
  return html;
};

NewsFeed.prototype.buildActiveFiltersHTML = function() {
  var self = this;
  var prefix = this.prefix;
  var chips = [];

  if (this.currentSearchQuery) {
    chips.push({
      label: 'Search: "' + this.currentSearchQuery + '"',
      type: 'search',
      value: ''
    });
  }

  if (this.currentTypeFilter !== 'all') {
    chips.push({
      label: this.capitalize(this.currentTypeFilter),
      type: 'type',
      value: this.currentTypeFilter
    });
  }

  this.selectedSources.forEach(function(source) {
    chips.push({
      label: source,
      type: 'source',
      value: source
    });
  });

  this.selectedYears.forEach(function(year) {
    chips.push({
      label: year,
      type: 'year',
      value: year
    });
  });

  if (chips.length === 0) {
    return '';
  }

  var html = '<div class="active-filters">' +
    '<span class="active-filters-label">Active filters:</span>';

  chips.forEach(function(chip) {
    html += '<span class="filter-chip">' +
      self.escapeHtml(chip.label) +
      '<button class="chip-remove" onclick="' + prefix + 'RemoveFilter(\'' + chip.type + '\', \'' +
      self.escapeHtml(chip.value).replace(/'/g, "\\'") + '\')" aria-label="Remove filter">&times;</button>' +
      '</span>';
  });

  if (chips.length > 1) {
    html += '<button class="clear-all-btn" onclick="' + prefix + 'ClearFilters()">Clear all</button>';
  }

  html += '</div>';
  return html;
};

NewsFeed.prototype.buildTypeFilterHTML = function() {
  var self = this;
  var prefix = this.prefix;
  var typeCounts = this.getTypeCounts();

  var html = '<div class="news-controls">' +
    '<div class="news-stats">Showing <strong>' + this.filteredStories.length + '</strong> of ' + this.allStories.length + ' stories</div>' +
    '<div class="news-filters">' +
    '<button class="filter-btn ' + (this.currentTypeFilter === 'all' ? 'active' : '') + '" ' +
    'onclick="' + prefix + 'FilterType(\'all\')" aria-pressed="' + (this.currentTypeFilter === 'all') + '">' +
    'All (' + this.allStories.length + ')</button>';

  this.filterTypes.forEach(function(type) {
    if (typeCounts[type]) {
      html += '<button class="filter-btn ' + (self.currentTypeFilter === type ? 'active' : '') + '" ' +
        'onclick="' + prefix + 'FilterType(\'' + type + '\')" aria-pressed="' + (self.currentTypeFilter === type) + '">' +
        self.capitalize(type) + ' (' + typeCounts[type] + ')</button>';
    }
  });

  html += '</div></div>';
  return html;
};

NewsFeed.prototype.buildPaginationHTML = function(totalPages) {
  if (totalPages <= 1) return '';

  var prefix = this.prefix;
  var currentPage = this.currentPage;

  var html = '<nav class="pagination" aria-label="News pagination">' +
    '<button class="pagination-btn" onclick="' + prefix + 'GoToPage(' + (currentPage - 1) + ')" ' +
    (currentPage === 1 ? 'disabled' : '') + ' aria-label="Previous page">&laquo; Prev</button>';

  var startPage = Math.max(1, currentPage - 2);
  var endPage = Math.min(totalPages, startPage + 4);
  startPage = Math.max(1, endPage - 4);

  if (startPage > 1) {
    html += '<button class="pagination-btn" onclick="' + prefix + 'GoToPage(1)">1</button>';
    if (startPage > 2) html += '<span class="pagination-info">...</span>';
  }

  for (var i = startPage; i <= endPage; i++) {
    html += '<button class="pagination-btn ' + (i === currentPage ? 'active' : '') + '" ' +
      'onclick="' + prefix + 'GoToPage(' + i + ')" aria-current="' + (i === currentPage ? 'page' : 'false') + '">' + i + '</button>';
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span class="pagination-info">...</span>';
    html += '<button class="pagination-btn" onclick="' + prefix + 'GoToPage(' + totalPages + ')">' + totalPages + '</button>';
  }

  html += '<button class="pagination-btn" onclick="' + prefix + 'GoToPage(' + (currentPage + 1) + ')" ' +
    (currentPage === totalPages ? 'disabled' : '') + ' aria-label="Next page">Next &raquo;</button>' +
    '</nav>';

  return html;
};

NewsFeed.prototype.goToPage = function(page) {
  var regularStories = this.hasFeatured ?
    this.filteredStories.filter(function(s) { return s.featured !== 1; }) :
    this.filteredStories;
  var totalPages = Math.ceil(regularStories.length / this.cardsPerPage);

  if (page < 1 || page > totalPages) return;
  this.currentPage = page;
  this.render();
  this.scrollToTop();
};

NewsFeed.prototype.scrollToTop = function() {
  var container = document.getElementById(this.containerId);
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// Helper functions
NewsFeed.prototype.capitalize = function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

NewsFeed.prototype.escapeHtml = function(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
};

NewsFeed.prototype.stripHtml = function(html) {
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

NewsFeed.prototype.formatDate = function(dateStr) {
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
};
