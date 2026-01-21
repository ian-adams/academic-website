import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import type { MPVRecord, MPVData, FilterState } from './types';
import ChartCard from './ChartCard';

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

  // Filter labels for display
  const causeLabel = filters.causeFilter === 'shootings' ? 'Fatal Shootings' : 'All Deaths';
  const yearLabel = filters.yearFilter === 'All' ? 'All Years' : filters.yearFilter;

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

  // Filter data (respects both cause and year filters)
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

  // Long data (only cause filter, for trend charts that need all years)
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
              <ChartCard
                title="Cumulative Trajectory"
                subtitle="Year-over-year comparison of cumulative deaths"
                causeLabel={causeLabel}
                yearLabel="All Years"
                isDark={isDark}
              >
                <CumulativeChart data={longData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Per Capita Rate"
                subtitle="Deaths per million population by year"
                causeLabel={causeLabel}
                yearLabel="All Years"
                isDark={isDark}
              >
                <PerCapitaChart data={longData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Temporal Heatmap"
                subtitle="Distribution by month and day of week"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <HeatmapChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Day of Week"
                subtitle="Average deaths by day of week"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <DayOfWeekChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
            </div>
          </div>
        )}

        {activeTab === 'demographics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Race Distribution"
                subtitle="Deaths by victim race"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <RaceDistributionChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Race by Year"
                subtitle="Racial composition over time"
                causeLabel={causeLabel}
                yearLabel="All Years"
                isDark={isDark}
              >
                <RaceByYearChart data={longData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Age Distribution"
                subtitle="Deaths by victim age"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <AgeDistributionChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Unarmed by Race"
                subtitle="Unarmed deaths broken down by race"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <UnarmedByRaceChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <div className="lg:col-span-2">
                <ChartCard
                  title="Age & Race"
                  subtitle="Age distribution by race"
                  causeLabel={causeLabel}
                  yearLabel={yearLabel}
                  isDark={isDark}
                >
                  <AgeRaceChart data={filteredData} population={POPULATION} isDark={isDark} />
                </ChartCard>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'behavioral' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Armed Status"
                subtitle="Victim armed/unarmed status"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <ArmedStatusChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Alleged Weapons"
                subtitle="Types of alleged weapons"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <WeaponsChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Fleeing Outcomes"
                subtitle="Outcomes by fleeing status"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <FleeingChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Mental Health Trend"
                subtitle="Cases involving mental health symptoms"
                causeLabel={causeLabel}
                yearLabel="All Years"
                isDark={isDark}
              >
                <MentalHealthChart data={longData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <div className="lg:col-span-2">
                <ChartCard
                  title="Body Camera Growth"
                  subtitle="Body camera presence over time"
                  causeLabel={causeLabel}
                  yearLabel="All Years"
                  isDark={isDark}
                >
                  <BodyCameraChart data={longData} population={POPULATION} isDark={isDark} />
                </ChartCard>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'geography' && (
          <div className="space-y-8">
            <ChartCard
              title="National Map"
              subtitle="Geographic distribution of deaths"
              causeLabel={causeLabel}
              yearLabel={yearLabel}
              isDark={isDark}
            >
              <USMapChart data={filteredData} population={POPULATION} isDark={isDark} />
            </ChartCard>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Top 15 States"
                subtitle="States with highest counts"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <TopStatesChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
              <ChartCard
                title="Top 20 Cities"
                subtitle="Cities with highest counts"
                causeLabel={causeLabel}
                yearLabel={yearLabel}
                isDark={isDark}
              >
                <TopCitiesChart data={filteredData} population={POPULATION} isDark={isDark} />
              </ChartCard>
            </div>
          </div>
        )}

        {activeTab === 'accountability' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Criminal Charges Trend"
              subtitle="Officers charged over time"
              causeLabel={causeLabel}
              yearLabel="All Years"
              isDark={isDark}
            >
              <CriminalChargesChart data={longData} population={POPULATION} isDark={isDark} />
            </ChartCard>
            <ChartCard
              title="Neighborhood Income Disparities"
              subtitle="Deaths by median household income"
              causeLabel={causeLabel}
              yearLabel={yearLabel}
              isDark={isDark}
            >
              <IncomeDisparitiesChart data={filteredData} population={POPULATION} isDark={isDark} />
            </ChartCard>
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
