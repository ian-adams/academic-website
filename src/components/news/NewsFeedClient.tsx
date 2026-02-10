import { useState, useEffect, useMemo } from 'react';

interface NewsStory {
  id: string;
  url: string;
  title: string;
  source: string;
  date: string;
  date_discovered: string;
  summary: string;
  story_type?: string;
  relevance_score?: number;
  key_entities?: string;
  location?: string | null;
  tags?: string[];
  needs_review?: number;
}

interface NewsFeed {
  updated: string;
  count: number;
  stories: NewsStory[];
}

interface NewsFeedClientProps {
  feedUrl: string;
  title: string;
  description?: string;
  accentColor?: string;
}

export default function NewsFeedClient({ feedUrl, title, description, accentColor = 'primary' }: NewsFeedClientProps) {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    async function fetchFeed() {
      try {
        const response = await fetch(feedUrl);
        if (!response.ok) throw new Error('Failed to fetch feed');
        const data = await response.json();
        setFeed(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchFeed();
  }, [feedUrl]);

  // Get unique tags from all stories
  const allTags = useMemo(() => {
    if (!feed) return [];
    const tagSet = new Set<string>();
    feed.stories.forEach((story) => {
      story.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [feed]);

  // Filter stories based on search and tag
  const filteredStories = useMemo(() => {
    if (!feed) return [];
    return feed.stories.filter((story) => {
      const matchesSearch =
        searchQuery === '' ||
        story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.source.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === null || story.tags?.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [feed, searchQuery, selectedTag]);

  // Paginate filtered stories
  const paginatedStories = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStories.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStories, currentPage]);

  const totalPages = Math.ceil(filteredStories.length / itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTag]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 dark:border-primary-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">Error loading feed: {error}</p>
      </div>
    );
  }

  if (!feed) return null;

  // Color classes based on accent
  const colorClasses = {
    primary: {
      border: 'border-primary-700 dark:border-primary-500',
      bar: 'bg-primary-700 dark:bg-primary-500',
      text: 'text-primary-700 dark:text-primary-400',
      badge: 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300',
    },
    blue: {
      border: 'border-blue-600 dark:border-blue-500',
      bar: 'bg-blue-600 dark:bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
    },
    amber: {
      border: 'border-amber-600 dark:border-amber-500',
      bar: 'bg-amber-600 dark:bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300',
    },
    rose: {
      border: 'border-rose-600 dark:border-rose-500',
      bar: 'bg-rose-600 dark:bg-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300',
    },
  };

  const colors = colorClasses[accentColor as keyof typeof colorClasses] || colorClasses.primary;

  return (
    <div>
      {/* Header with stats */}
      <header className={`border-b-4 ${colors.border} pb-8 mb-8`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-1 h-12 ${colors.bar}`}></div>
          <span className={`text-sm font-bold tracking-widest uppercase ${colors.text}`}>
            Curated News Feed
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 dark:text-white leading-tight mb-2">
              {title}
            </h1>
            {description && (
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-light">{description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={`flex items-center gap-2 ${colors.text}`}>
              <span className={`w-2 h-2 rounded-full ${colors.bar}`}></span>
              Updated: {new Date(feed.updated).toLocaleDateString()}
            </span>
            <span className={`flex items-center gap-2 ${colors.text}`}>
              <span className={`w-2 h-2 rounded-full ${colors.bar}`}></span>
              {feed.count.toLocaleString()} stories
            </span>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search stories..."
              aria-label="Search stories"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div>
            <select
              value={selectedTag || ''}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              aria-label="Filter by tag"
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Showing {paginatedStories.length} of {filteredStories.length} stories
      </p>

      {/* Stories grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedStories.map((story) => (
          <article
            key={story.id}
            className={`bg-white dark:bg-gray-800 border-l-4 ${colors.border} rounded-r-lg shadow-sm hover:shadow-md transition-shadow`}
          >
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-xs font-bold uppercase tracking-wide ${colors.text}`}>
                  {story.source}
                </span>
                <time className="text-xs text-gray-500 dark:text-gray-500">
                  {new Date(story.date).toLocaleDateString()}
                </time>
              </div>
              <h2 className="font-serif font-bold text-gray-900 dark:text-white mb-3 line-clamp-3 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                {story.title}
              </h2>
              {story.tags && story.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {story.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 text-xs rounded font-medium ${colors.badge}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </a>
          </article>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
