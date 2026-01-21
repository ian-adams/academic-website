import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import type { MPVRecord, MPVData, FilterState } from './types';

// Lazy load chart components
const CumulativeChart = lazy(() => import('./charts/CumulativeChart'));
const PerCapitaChart = lazy(() => import('./charts/PerCapitaChart'));
const HeatmapChart = lazy(() => import('./charts/HeatmapChart'));
const DayOfWeekChart = lazy(() => import('./charts/DayOfWeekChart'));
const RaceDistributionChart = lazy(() => import('./charts/RaceDistributionChart'));
const RaceByYearChart = lazy(() => import('./charts/RaceByYearChart'));
const AgeDistributionChart = lazy(() => import('./charts/AgeDistributionChart'));
const UnarmedByRaceChart = lazy(() => import('./charts/UnarmedByRaceChart'));
const AgeRaceChart = lazy(() => import('./charts/AgeRaceChart'));
const ArmedStatusChart = lazy(() => import('./charts/ArmedStatusChart'));
const WeaponsChart = lazy(() => import('./charts/WeaponsChart'));
const FleeingChart = lazy(() => import('./charts/FleeingChart'));
const MentalHealthChart = lazy(() => import('./charts/MentalHealthChart'));
const BodyCameraChart = lazy(() => import('./charts/BodyCameraChart'));
const USMapChart = lazy(() => import('./charts/USMapChart'));
const TopStatesChart = lazy(() => import('./charts/TopStatesChart'));
const TopCitiesChart = lazy(() => import('./charts/TopCitiesChart'));
const CriminalChargesChart = lazy(() => import('./charts/CriminalChargesChart'));
const IncomeDisparitiesChart = lazy(() => import('./charts/IncomeDisparitiesChart'));

const ChartLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 dark:border-primary-400"></div>
  </div>
);

// Population data
const POPULATION: Record<number, number> = {
  2013: 316128839,
  2014: 318857056,
  2015: 320738994,
  2016: 323071755,
  2017: 325084756,
  2018: 326687501,
  2019: 328239523,
  2020: 331449281,
  2021: 331893745,
  2022: 333287557,
  2023: 334914895,
  2024: 336673595,
  2025: 338289857,
};

export default function MPVDashboard() {
  const [data, setData] = useState<MPVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<FilterState>({
    causeFilter: 'all',
    yearFilter: 'All',
  });
  const [isDark, setIsDark] = useState(false);

  // Check dark mode
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/data/mpv-data.json');
        if (!response.ok) throw new Error('Failed to fetch MPV data');
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Get available years
  const years = useMemo(() => {
    if (!data) return [];
    const yearSet = new Set<number>();
    data.records.forEach((r) => yearSet.add(r.year));
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [data]);

  // Filter data
  const filteredData = useMemo(() => {
    if (!data) return [];
    let records = data.records;

    if (filters.causeFilter === 'shootings') {
      records = records.filter((r) => r.cause_of_death?.toLowerCase().includes('gunshot'));
    }

    if (filters.yearFilter !== 'All') {
      records = records.filter((r) => r.year === parseInt(filters.yearFilter));
    }

    return records;
  }, [data, filters]);

  // Long data (no year filter, for trend charts)
  const longData = useMemo(() => {
    if (!data) return [];
    if (filters.causeFilter === 'shootings') {
      return data.records.filter((r) => r.cause_of_death?.toLowerCase().includes('gunshot'));
    }
    return data.records;
  }, [data, filters.causeFilter]);

  // KPI calculations
  const kpis = useMemo(() => {
    if (filteredData.length === 0) {
      return { total: 0, rate: 'N/A', blackPct: '0%', unarmedPct: '0%' };
    }

    const total = filteredData.length;

    // Calculate rate
    const ratesByYear: { n: number; pop: number }[] = [];
    const yearCounts = filteredData.reduce((acc, r) => {
      acc[r.year] = (acc[r.year] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    Object.entries(yearCounts).forEach(([year, count]) => {
      const pop = POPULATION[parseInt(year)];
      if (pop) ratesByYear.push({ n: count, pop });
    });

    const avgRate =
      ratesByYear.length > 0
        ? ratesByYear.reduce((sum, r) => sum + (r.n / r.pop) * 1000000, 0) / ratesByYear.length
        : 0;

    const blackCount = filteredData.filter((r) => r.race_clean === 'Black').length;
    const unarmedCount = filteredData.filter((r) =>
      r.armed_unarmed_status?.toLowerCase().includes('unarmed')
    ).length;

    return {
      total: total.toLocaleString(),
      rate: avgRate.toFixed(2),
      blackPct: ((blackCount / total) * 100).toFixed(1) + '%',
      unarmedPct: ((unarmedCount / total) * 100).toFixed(1) + '%',
    };
  }, [filteredData]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'demographics', label: 'Demographics' },
    { id: 'behavioral', label: 'Behavioral & Context' },
    { id: 'geography', label: 'Geography' },
    { id: 'accountability', label: 'Accountability & Income' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-700 dark:border-primary-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 dark:text-red-400 mb-4">Error: {error}</p>
        <p className="text-gray-600 dark:text-gray-400">
          Please ensure the MPV data file is available at /data/mpv-data.json
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary-900 dark:text-gray-100 mb-4">
          MPV Analytical Dashboard
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl">
          Interactive analysis of Mapping Police Violence data. All results are descriptive; causal
          inference requires controls for local crime rates and deployment density.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Death Subset
          </label>
          <select
            value={filters.causeFilter}
            onChange={(e) =>
              setFilters((f) => ({ ...f, causeFilter: e.target.value as 'all' | 'shootings' }))
            }
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Deaths</option>
            <option value="shootings">Fatal Shootings</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Temporal Focus
          </label>
          <select
            value={filters.yearFilter}
            onChange={(e) => setFilters((f) => ({ ...f, yearFilter: e.target.value }))}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="All">All Years</option>
            {years.map((year) => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Value Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="value-box">
          <div className="value-box-title">Total Observations</div>
          <div className="value-box-value">{kpis.total}</div>
        </div>
        <div className="value-box">
          <div className="value-box-title">Mean Rate (per 1M)</div>
          <div className="value-box-value">{kpis.rate}</div>
        </div>
        <div className="value-box">
          <div className="value-box-title">Black Victim Share</div>
          <div className="value-box-value">{kpis.blackPct}</div>
        </div>
        <div className="value-box">
          <div className="value-box-title">Unarmed Share</div>
          <div className="value-box-value">{kpis.unarmedPct}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-700 text-primary-700 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <Suspense fallback={<ChartLoader />}>
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Cumulative Trajectory</h3>
                <CumulativeChart data={longData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Per Capita (Normalized)</h3>
                <PerCapitaChart data={longData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Temporal Heatmap</h3>
                <HeatmapChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Day of Week</h3>
                <DayOfWeekChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'demographics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Race Distribution</h3>
                <RaceDistributionChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Race by Year</h3>
                <RaceByYearChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Age Distribution</h3>
                <AgeDistributionChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Unarmed by Race</h3>
                <UnarmedByRaceChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold mb-4">Age & Race</h3>
                <AgeRaceChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'behavioral' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Armed Status</h3>
                <ArmedStatusChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Alleged Weapons</h3>
                <WeaponsChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Fleeing Outcomes</h3>
                <FleeingChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Mental Health Trend</h3>
                <MentalHealthChart data={longData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold mb-4">Body Camera Growth</h3>
                <BodyCameraChart data={longData} population={POPULATION} isDark={isDark} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'geography' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">National Map</h3>
              <USMapChart data={filteredData} population={POPULATION} isDark={isDark} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Top 15 States</h3>
                <TopStatesChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Top 20 Cities</h3>
                <TopCitiesChart data={filteredData} population={POPULATION} isDark={isDark} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accountability' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Criminal Charges Trend</h3>
              <CriminalChargesChart data={longData} population={POPULATION} isDark={isDark} />
            </div>
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Neighborhood Income Disparities</h3>
              <IncomeDisparitiesChart data={filteredData} population={POPULATION} isDark={isDark} />
            </div>
          </div>
        )}
      </Suspense>

      {/* Data note */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Data Source:</strong> Mapping Police Violence. Data is automatically synced and
          processed. Last updated: {data?.updated ? new Date(data.updated).toLocaleDateString() : 'Unknown'}.
        </p>
      </div>
    </div>
  );
}
