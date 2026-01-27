import { useState, useEffect } from 'react';

interface ScholarMetrics {
  name: string;
  affiliation: string;
  h_index: number | null;
  i10_index: number | null;
  citations: number | null;
  updated: string;
  scholar_url: string;
  error?: string;
}

interface ScholarMetricsDisplayProps {
  fallbackData?: ScholarMetrics;
}

/**
 * Client-side component that fetches scholar metrics at runtime.
 * This ensures the displayed data is always current, regardless of
 * when the site was built.
 */
export default function ScholarMetricsDisplay({ fallbackData }: ScholarMetricsDisplayProps) {
  const [metrics, setMetrics] = useState<ScholarMetrics | null>(fallbackData || null);
  const [loading, setLoading] = useState(!fallbackData);

  useEffect(() => {
    // Fetch fresh data client-side
    fetch('/data/scholar-metrics.json')
      .then(res => res.json())
      .then((data: ScholarMetrics) => {
        // Only update if we got valid data
        if (data.h_index !== null || data.citations !== null) {
          setMetrics(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch scholar metrics:', err);
        setLoading(false);
      });
  }, []);

  const displayValue = (value: number | null | undefined, fallback = '—') => {
    if (value === null || value === undefined) return fallback;
    return value.toLocaleString();
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {/* Total Citations */}
        <div className="bg-white dark:bg-gray-800 border-l-4 border-primary-700 dark:border-primary-500 rounded-r-lg shadow-sm p-4 text-center">
          <div className={`text-3xl font-bold text-gray-900 dark:text-white ${loading ? 'animate-pulse' : ''}`}>
            {loading ? '...' : displayValue(metrics?.citations)}
          </div>
          <div className="text-sm font-medium text-primary-700 dark:text-primary-400">Total Citations</div>
        </div>

        {/* h-index */}
        <div className="bg-white dark:bg-gray-800 border-l-4 border-primary-700 dark:border-primary-500 rounded-r-lg shadow-sm p-4 text-center group relative cursor-help !overflow-visible">
          <div className={`text-3xl font-bold text-gray-900 dark:text-white ${loading ? 'animate-pulse' : ''}`}>
            {loading ? '...' : displayValue(metrics?.h_index)}
          </div>
          <div className="text-sm font-medium text-primary-700 dark:text-primary-400">
            h-index
            <span className="inline-block ml-1 text-gray-400 dark:text-gray-500">&#9432;</span>
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none w-64 text-left z-50 shadow-lg">
            The h-index measures productivity and citation impact. An h-index of {metrics?.h_index || 'N'} means {metrics?.h_index || 'N'} publications have been cited at least {metrics?.h_index || 'N'} times each.
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        </div>

        {/* i10-index */}
        <div className="bg-white dark:bg-gray-800 border-l-4 border-primary-700 dark:border-primary-500 rounded-r-lg shadow-sm p-4 text-center group relative cursor-help !overflow-visible">
          <div className={`text-3xl font-bold text-gray-900 dark:text-white ${loading ? 'animate-pulse' : ''}`}>
            {loading ? '...' : displayValue(metrics?.i10_index)}
          </div>
          <div className="text-sm font-medium text-primary-700 dark:text-primary-400">
            i10-index
            <span className="inline-block ml-1 text-gray-400 dark:text-gray-500">&#9432;</span>
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none w-64 text-left z-50 shadow-lg">
            The i10-index counts publications with at least 10 citations. An i10-index of {metrics?.i10_index || 'N'} means {metrics?.i10_index || 'N'} publications have 10 or more citations.
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        </div>

        {/* Publications count - passed as prop */}
        <div className="bg-white dark:bg-gray-800 border-l-4 border-primary-700 dark:border-primary-500 rounded-r-lg shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white" id="pub-count">
            {/* This will be replaced by Astro with actual count */}
            <slot />
          </div>
          <div className="text-sm font-medium text-primary-700 dark:text-primary-400">Publications</div>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-500 mb-8 -mt-8">
        Metrics from <a
          href={metrics?.scholar_url || 'https://scholar.google.com/citations?user=g9lY5RUAAAAJ'}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary-700 dark:hover:text-primary-400"
        >
          Google Scholar
        </a>
        {metrics?.updated && (
          <span className="ml-2 text-gray-400">
            (updated {new Date(metrics.updated).toLocaleDateString()})
          </span>
        )}
      </p>
    </>
  );
}
