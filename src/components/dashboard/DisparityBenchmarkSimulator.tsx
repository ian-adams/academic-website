import { useState, useEffect, useMemo } from 'react';
import type { PlotParams } from 'react-plotly.js';
import { DARK_LAYOUT, LIGHT_LAYOUT } from './types';

// Purple/Indigo color palette for Disparity dashboard
const COLORS = {
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  accent: '#8B5CF6',
  navy: '#1E1B4B',
  slate: '#334155',
};

// Client-side only Plot component wrapper
function PlotWrapper(props: PlotParams) {
  const [Plot, setPlot] = useState<React.ComponentType<PlotParams> | null>(null);

  useEffect(() => {
    import('react-plotly.js').then((mod) => {
      setPlot(() => mod.default);
    });
  }, []);

  if (!Plot) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
      </div>
    );
  }

  return <Plot {...props} />;
}

// Data from Tregle, Nix & Alpert (2018) Table 1, extended with newer data
// Note: 2018-2023 data compiled from Washington Post, Census, PPCS, and FBI UCR
type YearData = { black: number; white: number; blackShot: number; whiteShot: number };

interface BenchmarkData {
  id: string;
  name: string;
  shortName: string;
  category: 'population' | 'interaction' | 'arrest';
  description: string;
  limitation: string;
  years: {
    2015: YearData;
    2016: YearData;
    2017: YearData;
    2018: YearData;
    2019: YearData;
    2020: YearData;
    2021: YearData;
    2022: YearData;
    2023: YearData;
  };
}

type AvailableYear = 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023;

const benchmarkData: BenchmarkData[] = [
  {
    id: 'population',
    name: 'Total Population',
    shortName: 'Population',
    category: 'population',
    description: 'US Census population figures. Assumes everyone has equal likelihood of police contact.',
    limitation: 'Fundamentally flawed: not everyone encounters police equally. Most people never interact with officers in situations that could become lethal.',
    years: {
      2015: { black: 39908095, white: 232943055, blackShot: 259, whiteShot: 497 },
      2016: { black: 40241818, white: 233657078, blackShot: 234, whiteShot: 466 },
      2017: { black: 41366336, white: 235494966, blackShot: 223, whiteShot: 458 },
      2018: { black: 41617764, white: 236173020, blackShot: 228, whiteShot: 459 },
      2019: { black: 42042342, white: 236690522, blackShot: 251, whiteShot: 424 },
      2020: { black: 41104200, white: 204277273, blackShot: 243, whiteShot: 459 },
      2021: { black: 41500000, white: 205000000, blackShot: 233, whiteShot: 446 },
      2022: { black: 42000000, white: 205500000, blackShot: 225, whiteShot: 389 },
      2023: { black: 42500000, white: 206000000, blackShot: 249, whiteShot: 499 },
    },
  },
  {
    id: 'police_contacts',
    name: 'Police-Initiated Contacts',
    shortName: 'Police Contacts',
    category: 'interaction',
    description: 'Estimated involuntary interactions with police from the Police-Public Contact Survey (PPCS).',
    limitation: 'PPCS data only updated every 3 years. 2015-2017 use 2011 wave; 2018+ use 2018 wave. Most contacts are minor and unlikely to escalate to lethal force.',
    years: {
      2015: { black: 2542400, white: 16642200, blackShot: 259, whiteShot: 497 },
      2016: { black: 2542400, white: 16642200, blackShot: 234, whiteShot: 466 },
      2017: { black: 2542400, white: 16642200, blackShot: 223, whiteShot: 458 },
      2018: { black: 2542400, white: 16642200, blackShot: 228, whiteShot: 459 },
      2019: { black: 2542400, white: 16642200, blackShot: 251, whiteShot: 424 },
      2020: { black: 2890000, white: 17800000, blackShot: 243, whiteShot: 459 },
      2021: { black: 2890000, white: 17800000, blackShot: 233, whiteShot: 446 },
      2022: { black: 2890000, white: 17800000, blackShot: 225, whiteShot: 389 },
      2023: { black: 2890000, white: 17800000, blackShot: 249, whiteShot: 499 },
    },
  },
  {
    id: 'traffic_stops',
    name: 'Traffic Stops',
    shortName: 'Traffic Stops',
    category: 'interaction',
    description: 'Estimated traffic stops (driver or passenger) from PPCS.',
    limitation: 'Traffic stops rarely escalate to lethal force. Does not account for differences in driving behavior or vehicle conditions.',
    years: {
      2015: { black: 2001000, white: 13997700, blackShot: 259, whiteShot: 497 },
      2016: { black: 2001000, white: 13997700, blackShot: 234, whiteShot: 466 },
      2017: { black: 2001000, white: 13997700, blackShot: 223, whiteShot: 458 },
      2018: { black: 2001000, white: 13997700, blackShot: 228, whiteShot: 459 },
      2019: { black: 2001000, white: 13997700, blackShot: 251, whiteShot: 424 },
      2020: { black: 2200000, white: 14500000, blackShot: 243, whiteShot: 459 },
      2021: { black: 2200000, white: 14500000, blackShot: 233, whiteShot: 446 },
      2022: { black: 2200000, white: 14500000, blackShot: 225, whiteShot: 389 },
      2023: { black: 2200000, white: 14500000, blackShot: 249, whiteShot: 499 },
    },
  },
  {
    id: 'street_stops',
    name: 'Street Stops',
    shortName: 'Street Stops',
    category: 'interaction',
    description: 'Estimated investigative street stops from PPCS where police suspected wrongdoing.',
    limitation: 'Street stops may themselves reflect biased policing practices.',
    years: {
      2015: { black: 541400, white: 2644500, blackShot: 259, whiteShot: 497 },
      2016: { black: 541400, white: 2644500, blackShot: 234, whiteShot: 466 },
      2017: { black: 541400, white: 2644500, blackShot: 223, whiteShot: 458 },
      2018: { black: 541400, white: 2644500, blackShot: 228, whiteShot: 459 },
      2019: { black: 541400, white: 2644500, blackShot: 251, whiteShot: 424 },
      2020: { black: 690000, white: 3300000, blackShot: 243, whiteShot: 459 },
      2021: { black: 690000, white: 3300000, blackShot: 233, whiteShot: 446 },
      2022: { black: 690000, white: 3300000, blackShot: 225, whiteShot: 389 },
      2023: { black: 690000, white: 3300000, blackShot: 249, whiteShot: 499 },
    },
  },
  {
    id: 'total_arrests',
    name: 'Total Arrests',
    shortName: 'All Arrests',
    category: 'arrest',
    description: 'All arrests reported to the FBI Uniform Crime Report.',
    limitation: 'Most arrests are for minor offenses where lethal force is rarely needed. Arrest data may reflect enforcement patterns. Note: 2020-2021 UCR data incomplete due to NIBRS transition.',
    years: {
      2015: { black: 2197140, white: 5753212, blackShot: 259, whiteShot: 497 },
      2016: { black: 2263112, white: 5858330, blackShot: 234, whiteShot: 466 },
      2017: { black: 2221697, white: 5626140, blackShot: 223, whiteShot: 458 },
      2018: { black: 2824823, white: 7114252, blackShot: 228, whiteShot: 459 },
      2019: { black: 2587418, white: 6747298, blackShot: 251, whiteShot: 424 },
      2020: { black: 1800000, white: 4900000, blackShot: 243, whiteShot: 459 },
      2021: { black: 1750000, white: 4800000, blackShot: 233, whiteShot: 446 },
      2022: { black: 1623876, white: 3927541, blackShot: 225, whiteShot: 389 },
      2023: { black: 1460000, white: 2920000, blackShot: 249, whiteShot: 499 },
    },
  },
  {
    id: 'violent_arrests',
    name: 'Violent Crime Arrests',
    shortName: 'Violent Crime',
    category: 'arrest',
    description: 'Arrests for murder, rape, robbery, or aggravated assault—situations with higher potential for lethal force.',
    limitation: 'Not all fatal OIS stem from violent crime situations. Arrest data generated by police may reflect bias.',
    years: {
      2015: { black: 140543, white: 232180, blackShot: 259, whiteShot: 497 },
      2016: { black: 153341, white: 241063, blackShot: 234, whiteShot: 466 },
      2017: { black: 151744, white: 236590, blackShot: 223, whiteShot: 458 },
      2018: { black: 162740, white: 248654, blackShot: 228, whiteShot: 459 },
      2019: { black: 158000, white: 242000, blackShot: 251, whiteShot: 424 },
      2020: { black: 140000, white: 220000, blackShot: 243, whiteShot: 459 },
      2021: { black: 145000, white: 225000, blackShot: 233, whiteShot: 446 },
      2022: { black: 155000, white: 235000, blackShot: 225, whiteShot: 389 },
      2023: { black: 159793, white: 200871, blackShot: 249, whiteShot: 499 },
    },
  },
  {
    id: 'weapons_arrests',
    name: 'Weapons Offense Arrests',
    shortName: 'Weapons Offenses',
    category: 'arrest',
    description: 'Arrests for carrying or possessing weapons—situations most likely to require lethal response.',
    limitation: '80%+ of fatal OIS involve armed suspects. But not all OIS stem from weapons situations.',
    years: {
      2015: { black: 44284, white: 63967, blackShot: 259, whiteShot: 497 },
      2016: { black: 51898, white: 69414, blackShot: 234, whiteShot: 466 },
      2017: { black: 56143, white: 68787, blackShot: 223, whiteShot: 458 },
      2018: { black: 60687, white: 72789, blackShot: 228, whiteShot: 459 },
      2019: { black: 62000, white: 74000, blackShot: 251, whiteShot: 424 },
      2020: { black: 55000, white: 65000, blackShot: 243, whiteShot: 459 },
      2021: { black: 58000, white: 68000, blackShot: 233, whiteShot: 446 },
      2022: { black: 60000, white: 70000, blackShot: 225, whiteShot: 389 },
      2023: { black: 62000, white: 72000, blackShot: 249, whiteShot: 499 },
    },
  },
];

function calculateRateRatio(
  blackShot: number,
  whiteShot: number,
  blackBenchmark: number,
  whiteBenchmark: number
): number {
  const blackRate = blackShot / blackBenchmark;
  const whiteRate = whiteShot / whiteBenchmark;
  return blackRate / whiteRate;
}

const availableYears: AvailableYear[] = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

export default function DisparityBenchmarkSimulator() {
  const [activeTab, setActiveTab] = useState('problem');
  const [selectedYear, setSelectedYear] = useState<AvailableYear>(2015);
  const [selectedBenchmark, setSelectedBenchmark] = useState('population');
  const [isDark, setIsDark] = useState(false);

  // Custom scenario inputs
  const [customBlackShot, setCustomBlackShot] = useState(259);
  const [customWhiteShot, setCustomWhiteShot] = useState(497);
  const [customBlackBenchmark, setCustomBlackBenchmark] = useState(39908095);
  const [customWhiteBenchmark, setCustomWhiteBenchmark] = useState(232943055);

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

  // Calculate all rate ratios for comparison chart
  const allRateRatios = useMemo(() => {
    return benchmarkData.map((b) => {
      const yearData = b.years[selectedYear];
      const or = calculateRateRatio(
        yearData.blackShot,
        yearData.whiteShot,
        yearData.black,
        yearData.white
      );
      return {
        id: b.id,
        name: b.shortName,
        category: b.category,
        rateRatio: or,
        interpretation: or > 1
          ? `Black ${or.toFixed(2)}x more likely`
          : `Black ${(1/or).toFixed(2)}x less likely`,
      };
    });
  }, [selectedYear]);

  // Get current benchmark data
  const currentBenchmark = benchmarkData.find((b) => b.id === selectedBenchmark)!;
  const currentYearData = currentBenchmark.years[selectedYear];
  const currentRateRatio = calculateRateRatio(
    currentYearData.blackShot,
    currentYearData.whiteShot,
    currentYearData.black,
    currentYearData.white
  );

  // Custom rate ratio
  const customRateRatio = calculateRateRatio(
    customBlackShot,
    customWhiteShot,
    customBlackBenchmark,
    customWhiteBenchmark
  );

  const tabs = [
    { id: 'problem', label: 'The Denominator Problem' },
    { id: 'compare', label: 'Benchmark Comparison' },
    { id: 'explore', label: 'Interactive Explorer' },
    { id: 'custom', label: 'Build Your Own' },
  ];

  const baseLayout = isDark ? DARK_LAYOUT : LIGHT_LAYOUT;

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <header className="border-b-4 border-violet-600 pb-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-12 bg-violet-600"></div>
          <span className="text-sm font-bold tracking-widest uppercase text-violet-600">
            Methodological Analysis
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 dark:text-white leading-tight mb-4">
          The Denominator Problem<br />
          <span className="text-violet-600">Why Benchmark Choice Matters</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl font-light leading-relaxed">
          Your choice of denominator can completely change—even reverse—conclusions
          about racial disparities in police use of force.
        </p>
        <div className="flex items-center gap-6 mt-6 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-violet-600 rounded-full"></span>
            Based on{' '}
            <a
              href="https://doi.org/10.1080/0735648X.2018.1547269"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Tregle, Nix & Alpert (2018)
            </a>
          </span>
        </div>
      </header>

      {/* Year Selector */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Select Year:
          </label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select year">
            {availableYears.map((year) => (
              <button
                key={year}
                role="radio"
                aria-checked={selectedYear === year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
                  selectedYear === year
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
          {selectedYear >= 2018 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 ml-auto">
              ⚠ {selectedYear >= 2020 ? 'UCR arrest data incomplete' : 'Includes some estimates'}
            </p>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="flex border-b border-gray-200 dark:border-gray-700 mb-8" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-4 text-sm font-semibold tracking-wide uppercase transition-colors relative ${
              activeTab === tab.id
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-600"></div>
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div style={{ display: activeTab === 'problem' ? 'block' : 'none' }}>
        <div className="space-y-6">
          {/* Key Insight Banner */}
          <div className="bg-gray-900 dark:bg-gray-800 text-white p-8 -mx-4 sm:mx-0">
            <div className="max-w-4xl">
              <h3 className="text-3xl font-serif font-bold mb-4">What's Your Denominator?</h3>
              <p className="text-xl text-gray-300 leading-relaxed mb-4">
                In {selectedYear}, police fatally shot <strong className="text-violet-400">{benchmarkData[0].years[selectedYear].blackShot}</strong> Black citizens and <strong className="text-violet-400">{benchmarkData[0].years[selectedYear].whiteShot}</strong> White citizens.
              </p>
              <p className="text-gray-300 leading-relaxed">
                Black citizens are ~13% of the US population but ~26% of those fatally shot.
                Does this prove racial bias? <strong className="text-violet-400">It depends entirely on your choice of benchmark.</strong>
              </p>
            </div>
          </div>

          {/* The Iceberg Metaphor */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-violet-600"></span>
              The Hidden Denominator
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  When analyzing rates, we need both a <strong>numerator</strong> (what happened) and
                  a <strong>denominator</strong> (the at-risk population). The denominator is like the
                  hidden part of an iceberg—often unseen, but critical.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                    <span><strong>Numerator:</strong> Fatal OIS by race (known from Washington Post data)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-600 dark:text-violet-400 font-bold">?</span>
                    <span><strong>Denominator:</strong> Who is at risk of being shot? (debated)</span>
                  </li>
                </ul>
              </div>
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-4">
                <h4 className="font-bold text-violet-800 dark:text-violet-200 mb-3">The Formula</h4>
                <div className="bg-white dark:bg-gray-900 p-4 font-mono text-sm text-center">
                  <div className="mb-2">
                    <span className="text-violet-600 dark:text-violet-400">[Black Shot ÷ Black Benchmark]</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">[White Shot ÷ White Benchmark]</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Rate Ratio: &gt;1 means Black more likely, &lt;1 means White more likely
                </p>
              </div>
            </div>
          </div>

          {/* Why Population Fails */}
          <div className="bg-gray-100 dark:bg-gray-900 p-6 border-l-4 border-violet-600">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Why Population is a Flawed Benchmark</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Using population assumes <em>everyone has an equal chance of encountering police</em>.
              This is demonstrably false:
            </p>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li>• Black citizens are more likely to be stopped by police</li>
              <li>• Black citizens are more likely to be arrested</li>
              <li>• Most people (of any race) never have police encounters that could turn lethal</li>
              <li>• The "at-risk" population is not the general population</li>
            </ul>
          </div>

          {/* Quick Comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-6 text-center">
              <div className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-2">Using Population ({selectedYear})</div>
              <div className="text-5xl font-bold font-serif text-rose-600 dark:text-rose-400">
                {allRateRatios.find(o => o.id === 'population')?.rateRatio.toFixed(2)}x
              </div>
              <div className="text-sm text-rose-700 dark:text-rose-300 mt-2">Black citizens more likely</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 text-center">
              <div className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-2">Using Weapons Arrests ({selectedYear})</div>
              <div className="text-5xl font-bold font-serif text-blue-600 dark:text-blue-400">
                {(1 / (allRateRatios.find(o => o.id === 'weapons_arrests')?.rateRatio || 1)).toFixed(2)}x
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-2">White citizens more likely</div>
            </div>
          </div>

          <div className="bg-gray-900 dark:bg-gray-800 p-6 text-center">
            <p className="text-xl font-serif text-white">
              Same numerator. Different denominators. <span className="text-violet-400">Opposite conclusions.</span>
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'compare' ? 'block' : 'none' }}>
        <div className="space-y-6">
          {/* Comparison Chart */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-violet-600"></span>
              Rate Ratios by Benchmark ({selectedYear})
            </h3>
            <PlotWrapper
              key={`comparison-${selectedYear}`}
              data={[
                {
                  x: allRateRatios.map((o) => o.rateRatio),
                  y: allRateRatios.map((o) => o.name),
                  type: 'bar',
                  orientation: 'h',
                  marker: {
                    color: allRateRatios.map((o) =>
                      o.rateRatio > 1 ? '#dc2626' : '#2563eb'
                    ),
                  },
                  text: allRateRatios.map((o) => o.rateRatio.toFixed(2)),
                  textposition: 'outside',
                  hovertemplate: '%{y}: %{x:.2f}<extra></extra>',
                },
              ]}
              layout={{
                ...baseLayout,
                autosize: true,
                height: 400,
                margin: { l: 130, r: 60, t: 30, b: 60 },
                showlegend: false,
                xaxis: {
                  title: 'Rate Ratio (Black vs White)',
                  gridcolor: isDark ? '#374151' : '#e5e7eb',
                  zeroline: false,
                  range: [0, 4.5],
                  dtick: 1,
                },
                yaxis: {
                  ...baseLayout.yaxis,
                  automargin: true,
                },
                shapes: [
                  {
                    type: 'line',
                    xref: 'x',
                    yref: 'paper',
                    x0: 1,
                    x1: 1,
                    y0: 0,
                    y1: 1,
                    line: { color: isDark ? '#fbbf24' : '#b45309', width: 2, dash: 'dot' },
                  },
                ],
                annotations: [
                  {
                    x: 1,
                    xref: 'x',
                    y: 1.08,
                    yref: 'paper',
                    text: 'No disparity (1.0)',
                    showarrow: false,
                    font: { size: 11, color: isDark ? '#fbbf24' : '#b45309' },
                  },
                ],
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '400px' }}
            />
            <div className="flex justify-center gap-8 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-rose-600 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Black more likely (&gt;1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">White more likely (&lt;1)</span>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-violet-600"></span>
              Detailed Comparison ({selectedYear})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Benchmark</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Black Benchmark</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">White Benchmark</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Rate Ratio</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkData.map((b) => {
                    const yearData = b.years[selectedYear];
                    const or = calculateRateRatio(yearData.blackShot, yearData.whiteShot, yearData.black, yearData.white);
                    return (
                      <tr key={b.id} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{b.name}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{yearData.black.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{yearData.white.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-center font-bold ${or > 1 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {or.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {or > 1 ? `Black ${or.toFixed(1)}x more likely` : `White ${(1/or).toFixed(1)}x more likely`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Note: Fatal OIS in {selectedYear}: {benchmarkData[0].years[selectedYear].blackShot} Black, {benchmarkData[0].years[selectedYear].whiteShot} White
            </p>
          </div>

          {/* Benchmark Categories */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 border-l-4 border-violet-500 p-6">
              <h4 className="font-bold text-violet-700 dark:text-violet-300 mb-2">Population-Based</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Census data. Simple but flawed—assumes equal police contact rates.
              </p>
              <div className="text-3xl font-bold font-serif text-violet-600 dark:text-violet-400">
                {allRateRatios.find(o => o.id === 'population')?.rateRatio.toFixed(2)}x
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border-l-4 border-amber-500 p-6">
              <h4 className="font-bold text-amber-700 dark:text-amber-300 mb-2">Interaction-Based</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                PPCS survey data. Better than population but most contacts are low-risk.
              </p>
              <div className="text-3xl font-bold font-serif text-amber-600 dark:text-amber-400">
                {allRateRatios.find(o => o.id === 'street_stops')?.rateRatio.toFixed(2)}x
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border-l-4 border-teal-500 p-6">
              <h4 className="font-bold text-teal-700 dark:text-teal-300 mb-2">Arrest-Based</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                UCR arrest data. Closer to lethal-risk situations but may reflect enforcement bias.
              </p>
              <div className="text-3xl font-bold font-serif text-teal-600 dark:text-teal-400">
                {allRateRatios.find(o => o.id === 'weapons_arrests')?.rateRatio.toFixed(2)}x
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'explore' ? 'block' : 'none' }}>
        <div className="space-y-6">
          {/* Benchmark Selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-violet-600"></span>
              Select a Benchmark
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {benchmarkData.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBenchmark(b.id)}
                  className={`p-3 text-sm font-semibold transition-colors text-left ${
                    selectedBenchmark === b.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {b.shortName}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Benchmark Details */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{currentBenchmark.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{currentBenchmark.description}</p>

              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 p-4 mb-4">
                <h4 className="font-bold text-violet-800 dark:text-violet-200 mb-1">Limitation</h4>
                <p className="text-sm text-violet-700 dark:text-violet-300">{currentBenchmark.limitation}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Black Benchmark ({selectedYear})</span>
                  <span className="font-medium">{currentYearData.black.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">White Benchmark ({selectedYear})</span>
                  <span className="font-medium">{currentYearData.white.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Black Fatally Shot</span>
                  <span className="font-medium">{currentYearData.blackShot}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">White Fatally Shot</span>
                  <span className="font-medium">{currentYearData.whiteShot}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-violet-600"></span>
                Result
              </h3>

              <div className={`p-6 rounded-lg text-center mb-4 ${
                currentRateRatio > 1
                  ? 'bg-rose-50 dark:bg-rose-900/20'
                  : 'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rate Ratio</div>
                <div className={`text-5xl font-bold ${
                  currentRateRatio > 1
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {currentRateRatio.toFixed(2)}
                </div>
                <div className={`text-lg mt-2 ${
                  currentRateRatio > 1
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {currentRateRatio > 1
                    ? `Black citizens ${currentRateRatio.toFixed(1)}x more likely to be fatally shot`
                    : `White citizens ${(1/currentRateRatio).toFixed(1)}x more likely to be fatally shot`
                  }
                </div>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                <h4 className="font-medium mb-2">Calculation:</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 font-mono text-xs">
                  <div>Black rate: {currentYearData.blackShot} / {currentYearData.black.toLocaleString()} = {(currentYearData.blackShot / currentYearData.black * 100000).toFixed(2)} per 100k</div>
                  <div>White rate: {currentYearData.whiteShot} / {currentYearData.white.toLocaleString()} = {(currentYearData.whiteShot / currentYearData.white * 100000).toFixed(2)} per 100k</div>
                  <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                    RR = {(currentYearData.blackShot / currentYearData.black * 100000).toFixed(2)} / {(currentYearData.whiteShot / currentYearData.white * 100000).toFixed(2)} = <strong>{currentRateRatio.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Comparison */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-violet-600"></span>
              Rate Comparison ({currentBenchmark.shortName})
            </h3>
            <PlotWrapper
              key={`rate-${selectedYear}-${selectedBenchmark}`}
              data={[
                {
                  x: ['Black Citizens', 'White Citizens'],
                  y: [
                    currentYearData.blackShot / currentYearData.black * 100000,
                    currentYearData.whiteShot / currentYearData.white * 100000,
                  ],
                  type: 'bar',
                  marker: {
                    color: ['#3b82f6', '#9ca3af'],
                  },
                  text: [
                    (currentYearData.blackShot / currentYearData.black * 100000).toFixed(2),
                    (currentYearData.whiteShot / currentYearData.white * 100000).toFixed(2),
                  ],
                  textposition: 'outside',
                },
              ]}
              layout={{
                ...baseLayout,
                autosize: true,
                height: 300,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                showlegend: false,
                yaxis: {
                  ...baseLayout.yaxis,
                  title: 'Fatal OIS per 100,000',
                },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '300px' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'custom' ? 'block' : 'none' }}>
        <div className="space-y-6">
          {/* Banner */}
          <div className="bg-gray-900 dark:bg-gray-800 text-white p-6 -mx-4 sm:mx-0">
            <div className="max-w-4xl">
              <h3 className="text-2xl font-serif font-bold mb-3">Build Your Own Scenario</h3>
              <p className="text-gray-300 leading-relaxed">
                Enter custom values to see how different numerators and denominators affect the rate ratio.
                This helps illustrate why benchmark selection is so critical.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-violet-600"></span>
                Input Values
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Black Fatally Shot</label>
                    <input
                      type="number"
                      value={customBlackShot}
                      onChange={(e) => setCustomBlackShot(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">White Fatally Shot</label>
                    <input
                      type="number"
                      value={customWhiteShot}
                      onChange={(e) => setCustomWhiteShot(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Black Benchmark</label>
                    <input
                      type="number"
                      value={customBlackBenchmark}
                      onChange={(e) => setCustomBlackBenchmark(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">White Benchmark</label>
                    <input
                      type="number"
                      value={customWhiteBenchmark}
                      onChange={(e) => setCustomWhiteBenchmark(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-medium mb-2">Quick Presets</h4>
                  <div className="flex flex-wrap gap-2">
                    {benchmarkData.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          const data = b.years[selectedYear];
                          setCustomBlackShot(data.blackShot);
                          setCustomWhiteShot(data.whiteShot);
                          setCustomBlackBenchmark(data.black);
                          setCustomWhiteBenchmark(data.white);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                      >
                        {b.shortName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-violet-600"></span>
                Your Result
              </h3>

              <div className={`p-6 rounded-lg text-center mb-4 ${
                customRateRatio > 1
                  ? 'bg-rose-50 dark:bg-rose-900/20'
                  : 'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rate Ratio</div>
                <div className={`text-5xl font-bold ${
                  customRateRatio > 1
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {isFinite(customRateRatio) ? customRateRatio.toFixed(2) : '—'}
                </div>
                <div className={`text-lg mt-2 ${
                  customRateRatio > 1
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {isFinite(customRateRatio) && (
                    customRateRatio > 1
                      ? `Black ${customRateRatio.toFixed(1)}x more likely`
                      : `White ${(1/customRateRatio).toFixed(1)}x more likely`
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 font-mono text-xs">
                  <div>Black rate: {customBlackShot} / {customBlackBenchmark.toLocaleString()} = {(customBlackShot / customBlackBenchmark * 100000).toFixed(4)} per 100k</div>
                  <div>White rate: {customWhiteShot} / {customWhiteBenchmark.toLocaleString()} = {(customWhiteShot / customWhiteBenchmark * 100000).toFixed(4)} per 100k</div>
                  <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                    Rate Ratio = <strong>{isFinite(customRateRatio) ? customRateRatio.toFixed(2) : '—'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Takeaway */}
          <div className="bg-gray-100 dark:bg-gray-900 p-6 border-l-4 border-violet-600">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Key Takeaways</h3>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">1.</span>
                <span><strong>Disparity ≠ Bias:</strong> Observed disparities depend heavily on benchmark choice. Different benchmarks yield different—even opposite—conclusions.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">2.</span>
                <span><strong>No perfect benchmark exists:</strong> Each has strengths and limitations. Population is convenient but flawed. Arrests may reflect enforcement bias.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">3.</span>
                <span><strong>Context matters:</strong> The "at-risk" population for fatal OIS is not the general population—it's those who encounter police in potentially lethal situations.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">4.</span>
                <span><strong>Be skeptical of simple claims:</strong> Anyone citing disparity statistics without discussing their benchmark choice is presenting incomplete analysis.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-gray-800 p-6 border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
            Citation
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Tregle, B., Nix, J., & Alpert, G. P. (2018). Disparity does not mean bias:
            Making sense of observed racial disparities in fatal officer-involved shootings with multiple benchmarks.
            <em> Journal of Crime and Justice</em>.{' '}
            <a
              href="https://doi.org/10.1080/0735648X.2018.1547269"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              https://doi.org/10.1080/0735648X.2018.1547269
            </a>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
            <strong>Data sources (2018-2023):</strong> Fatal OIS from Washington Post Fatal Force Database;
            Population from US Census ACS; PPCS data from BJS (2018 wave for 2020+);
            Arrests from FBI UCR/Crime Data Explorer. 2020-2021 arrest data incomplete due to NIBRS transition.
          </p>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6 text-sm text-gray-500 dark:text-gray-400">
          <div>
            Interactive analysis by{' '}
            <a href="https://ianadamsresearch.com" className="text-violet-600 hover:underline">
              Ian T. Adams, Ph.D.
            </a>
          </div>
          <div className="text-xs">
            Benchmark selection is an analytical choice with significant implications.
          </div>
        </div>
      </footer>
    </div>
  );
}
