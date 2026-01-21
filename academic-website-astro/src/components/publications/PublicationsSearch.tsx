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
}

interface Props {
  publications: Publication[];
}

export default function PublicationsSearch({ publications }: Props) {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Get unique years for filter dropdown
  const years = useMemo(() => {
    const uniqueYears = [...new Set(publications.map(p => p.year))];
    return uniqueYears.sort((a, b) => b - a);
  }, [publications]);

  // Filter publications based on search and year
  const filtered = useMemo(() => {
    return publications.filter(pub => {
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
  }, [publications, search, yearFilter]);

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

  return (
    <div>
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, author, journal, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
        <div className="sm:w-40">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
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
        Showing {filtered.length} of {publications.length} publications
        {search && <span> matching "<strong>{search}</strong>"</span>}
        {yearFilter !== 'all' && <span> from {yearFilter}</span>}
      </p>

      {/* Publications List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg">No publications found</p>
          <p className="text-sm mt-2">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="space-y-12">
          {sortedYears.map(year => (
            <section key={year}>
              <h2 className="text-2xl font-serif font-bold text-primary-900 dark:text-gray-100 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                {year}
                <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-2">
                  ({groupedByYear[year].length} {groupedByYear[year].length === 1 ? 'publication' : 'publications'})
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
                        {pub.featured && (
                          <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-accent-gold/20 text-accent-gold rounded">
                            Featured
                          </span>
                        )}
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
