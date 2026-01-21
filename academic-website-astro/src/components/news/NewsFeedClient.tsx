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
}

export default function NewsFeedClient({ feedUrl, title, description }: NewsFeedClientProps) {
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

  return (
    <div>
      {/* Header with stats */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary-900 dark:text-gray-100 mb-2">
              {title}
            </h1>
            {description && (
              <p className="text-xl text-gray-600 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>Updated: {new Date(feed.updated).toLocaleDateString()}</p>
            <p>{feed.count.toLocaleString()} total stories</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search stories..."
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
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
          >
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-primary-700 dark:text-primary-400 uppercase">
                  {story.source}
                </span>
                <time className="text-xs text-gray-500 dark:text-gray-500">
                  {new Date(story.date).toLocaleDateString()}
                </time>
              </div>
              <h2 className="font-serif font-semibold text-primary-900 dark:text-gray-100 mb-3 line-clamp-3 hover:text-accent-burgundy dark:hover:text-accent-gold transition-colors">
                {story.title}
              </h2>
              {story.tags && story.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {story.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
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
