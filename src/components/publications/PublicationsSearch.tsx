import { useState, useMemo } from 'react';

interface Publication {
  slug: string;
  title: string;
  authors: string[];
  date: string;
  year: number;
  publication?: string;
  summary?: string;
  featured?: boolean;
  url_source?: string;
  url_pdf?: string[];
  isPreprint: boolean;
}

interface Props {
  publications: Publication[];
  onCountChange?: (count: number) => void;
}

export default function PublicationsSearch({ publications, onCountChange }: Props) {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'publications' | 'preprints'>('publications');

  // Separate publications and preprints
  const { pubs, preprints } = useMemo(() => {
    const pubs = publications.filter(p => !p.isPreprint);
    const preprints = publications.filter(p => p.isPreprint);
    return { pubs, preprints };
  }, [publications]);

  // Get the base dataset based on view mode
  const baseData = viewMode === 'publications' ? pubs : preprints;

  // Get unique years for filter dropdown
  const years = useMemo(() => {
    const uniqueYears = [...new Set(baseData.map(p => p.year))];
    return uniqueYears.sort((a, b) => b - a);
  }, [baseData]);

  // Filter publications based on search and year
  const filtered = useMemo(() => {
    const result = baseData.filter(pub => {
      const searchLower = search.toLowerCase();
      const matchesSearch = search === '' ||
        pub.title.toLowerCase().includes(searchLower) ||
        pub.authors.some(a => a.toLowerCase().includes(searchLower)) ||
        pub.publication?.toLowerCase().includes(searchLower) ||
        pub.summary?.toLowerCase().includes(searchLower) ||
        pub.year.toString().includes(searchLower);

      const matchesYear = yearFilter === 'all' || pub.year.toString() === yearFilter;

      return matchesSearch && matchesYear;
    });

    // Notify parent of count change
    if (onCountChange) {
      onCountChange(result.length);
    }

    return result;
  }, [baseData, search, yearFilter, onCountChange]);

  // Group filtered results by year
  const groupedByYear = useMemo(() => {
    const groups: Record<number, Publication[]> = {};
    filtered.forEach(pub => {
      if (!groups[pub.year]) groups[pub.year] = [];
      groups[pub.year].push(pub);
    });
    return groups;
  }, [filtered]);

  const sortedYears = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

  // Reset year filter when switching view modes
  const handleViewModeChange = (mode: 'publications' | 'preprints') => {
    setViewMode(mode);
    setYearFilter('all');
    setSearch('');
  };

  return (
    <div>
      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => handleViewModeChange('publications')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'publications'
              ? 'bg-primary-700 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Publications ({pubs.length})
        </button>
        <button
          onClick={() => handleViewModeChange('preprints')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'preprints'
              ? 'bg-primary-700 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Preprints ({preprints.length})
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, author, journal, or keyword..."
            aria-label="Search publications"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
        <div className="sm:w-40">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            aria-label="Filter by year"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          >
            <option value="all">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Showing {filtered.length} of {baseData.length} {viewMode}
        {search && <span> matching "<strong>{search}</strong>"</span>}
        {yearFilter !== 'all' && <span> from {yearFilter}</span>}
      </p>

      {/* Publications List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg">No {viewMode} found</p>
          <p className="text-sm mt-2">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="space-y-12">
          {sortedYears.map(year => (
            <section key={year}>
              <h2 className="text-2xl font-serif font-bold text-primary-900 dark:text-gray-100 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                {year}
                <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-2">
                  ({groupedByYear[year].length} {groupedByYear[year].length === 1 ? (viewMode === 'publications' ? 'publication' : 'preprint') : viewMode})
                </span>
              </h2>

              <div className="space-y-4">
                {groupedByYear[year].map(pub => (
                  <article key={pub.slug} className="card p-6 group">
                    <a href={`/publications/${pub.slug}`} className="block">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-serif font-semibold text-primary-900 dark:text-gray-100 group-hover:text-accent-burgundy dark:group-hover:text-accent-gold transition-colors mb-2">
                            {pub.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {pub.authors.map((author, i) => (
                              <span key={i}>
                                <span className={author.includes('Ian') ? 'font-semibold' : ''}>{author}</span>
                                {i < pub.authors.length - 1 && ', '}
                              </span>
                            ))}
                          </p>
                          {pub.publication && (
                            <p className="text-sm italic text-gray-500 dark:text-gray-500">
                              {pub.publication}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {pub.featured && (
                            <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-accent-gold/20 text-accent-gold rounded">
                              Featured
                            </span>
                          )}
                          {pub.isPreprint && viewMode === 'publications' && (
                            <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                              Preprint
                            </span>
                          )}
                        </div>
                      </div>

                      {pub.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">
                          {pub.summary}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-4">
                        {pub.url_source && (
                          <span className="text-xs text-primary-700 dark:text-primary-400">
                            View Publication
                          </span>
                        )}
                        {pub.url_pdf && pub.url_pdf.length > 0 && (
                          <span className="text-xs text-primary-700 dark:text-primary-400">
                            PDF Available
                          </span>
                        )}
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
