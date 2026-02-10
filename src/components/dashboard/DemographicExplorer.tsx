import { useState, useEffect, useMemo } from 'react';
import type { PlotParams } from 'react-plotly.js';

function PlotWrapper(props: PlotParams) {
  const [Plot, setPlot] = useState<React.ComponentType<PlotParams> | null>(null);

  useEffect(() => {
    import('react-plotly.js').then((mod) => {
      setPlot(() => mod.default);
    });
  }, []);

  if (!Plot) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return <Plot {...props} />;
}

interface DemographicEffects {
  female: number;
  nonWhite: number;
  collegeEducated: number;
  higherIncome: number;
  republican: number;
  democrat: number;
}

interface ComparisonData {
  demographicEffects: {
    appropriate: DemographicEffects;
    professional: DemographicEffects;
    trust: DemographicEffects;
    discipline: DemographicEffects;
  };
  keyFindings: Array<{
    title: string;
    description: string;
  }>;
}

type Outcome = 'appropriate' | 'professional' | 'trust' | 'discipline';

const DEMOGRAPHIC_LABELS: Record<keyof DemographicEffects, string> = {
  female: 'Female',
  nonWhite: 'Non-White',
  collegeEducated: 'College Educated',
  higherIncome: 'Higher Income',
  republican: 'Republican',
  democrat: 'Democrat',
};

const DEMOGRAPHIC_DESCRIPTIONS: Record<keyof DemographicEffects, string> = {
  female: 'Compared to male respondents',
  nonWhite: 'Compared to white respondents',
  collegeEducated: 'Compared to non-college respondents',
  higherIncome: 'Compared to lower income respondents',
  republican: 'Compared to independents',
  democrat: 'Compared to independents',
};

export default function DemographicExplorer() {
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>('appropriate');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/data/profanity/comparison-data.json');
        if (!response.ok) throw new Error('Failed to fetch comparison data');
        const data = await response.json();
        setComparisonData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const sortedEffects = useMemo(() => {
    if (!comparisonData) return [];

    const effects = comparisonData.demographicEffects[selectedOutcome];
    const entries = Object.entries(effects) as [keyof DemographicEffects, number][];

    return entries.sort((a, b) => {
      if (selectedOutcome === 'discipline') {
        return b[1] - a[1]; // Higher discipline = less accepting, so reverse
      }
      return a[1] - b[1]; // Lower appropriate/professional = less accepting
    });
  }, [comparisonData, selectedOutcome]);

  const chartLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: isDark ? '#e5e7eb' : '#1f2937',
      family: 'Inter, system-ui, sans-serif',
    },
    margin: { l: 120, r: 30, t: 40, b: 60 },
    xaxis: {
      gridcolor: isDark ? '#374151' : '#e5e7eb',
      linecolor: isDark ? '#4b5563' : '#d1d5db',
    },
    yaxis: {
      gridcolor: isDark ? '#374151' : '#e5e7eb',
      linecolor: isDark ? '#4b5563' : '#d1d5db',
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (error || !comparisonData) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg">
        <p className="text-red-700 dark:text-red-400">{error || 'Failed to load data'}</p>
      </div>
    );
  }

  const effects = comparisonData.demographicEffects[selectedOutcome];
  const demographics = Object.keys(effects) as (keyof DemographicEffects)[];

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Who Judges Police Profanity More Harshly?
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Demographic characteristics predict how people judge police profanity. The coefficients below
          show how much each group differs from the reference category, controlling for other factors.
          Negative values for appropriateness/professionalism mean stricter judgments; positive values
          for discipline mean recommending more punishment.
        </p>
      </div>

      {/* Outcome selector */}
      <div className="flex flex-wrap gap-2 justify-center" role="radiogroup" aria-label="Outcome measure">
        {(['appropriate', 'professional', 'trust', 'discipline'] as Outcome[]).map(outcome => (
          <button
            key={outcome}
            role="radio"
            aria-checked={selectedOutcome === outcome}
            onClick={() => setSelectedOutcome(outcome)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              selectedOutcome === outcome
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Coefficient chart */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {selectedOutcome.charAt(0).toUpperCase() + selectedOutcome.slice(1)} Effects by Group
          </h3>

          <PlotWrapper
            data={[
              {
                y: demographics.map(d => DEMOGRAPHIC_LABELS[d]),
                x: demographics.map(d => effects[d]),
                type: 'bar',
                orientation: 'h',
                marker: {
                  color: demographics.map(d => {
                    const val = effects[d];
                    if (selectedOutcome === 'discipline') {
                      return val > 0 ? '#EF4444' : '#3B82F6';
                    }
                    return val < 0 ? '#EF4444' : '#3B82F6';
                  }),
                },
                hovertemplate: '%{y}: %{x:.3f}<extra></extra>',
              },
            ]}
            layout={{
              ...chartLayout,
              height: 350,
              xaxis: {
                ...chartLayout.xaxis,
                title: 'Coefficient (change from reference)',
                zeroline: true,
                zerolinecolor: isDark ? '#6b7280' : '#9ca3af',
                zerolinewidth: 2,
              },
              yaxis: {
                ...chartLayout.yaxis,
                automargin: true,
              },
              shapes: [
                {
                  type: 'line',
                  x0: 0,
                  x1: 0,
                  y0: -0.5,
                  y1: 5.5,
                  line: {
                    color: isDark ? '#6b7280' : '#9ca3af',
                    width: 2,
                  },
                },
              ],
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: '100%', height: '350px' }}
          />
        </div>

        {/* Interpretation cards */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            What the Numbers Mean
          </h3>

          {sortedEffects.slice(0, 3).map(([key, value]) => {
            const isStricter = selectedOutcome === 'discipline' ? value > 0 : value < 0;
            return (
              <div
                key={key}
                className={`p-4 rounded-lg border ${
                  isStricter
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {DEMOGRAPHIC_LABELS[key]}
                  </span>
                  <span className={`font-mono font-bold ${
                    isStricter
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {value > 0 ? '+' : ''}{value.toFixed(3)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {DEMOGRAPHIC_DESCRIPTIONS[key]}.{' '}
                  {isStricter
                    ? `Judges police profanity more harshly (${
                        selectedOutcome === 'discipline'
                          ? 'recommends more discipline'
                          : 'rates as less appropriate/professional'
                      }).`
                    : `More accepting of police profanity (${
                        selectedOutcome === 'discipline'
                          ? 'recommends less discipline'
                          : 'rates as more appropriate/professional'
                      }).`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key findings */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Key Demographic Patterns</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {comparisonData.keyFindings.slice(2).map((finding, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{finding.title}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{finding.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Political divide visualization */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          The Political Divide
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Political affiliation is one of the strongest predictors of how people judge police profanity.
        </p>

        <PlotWrapper
          data={[
            {
              x: ['Appropriateness', 'Professionalism', 'Trust', 'Discipline'],
              y: [
                comparisonData.demographicEffects.appropriate.republican,
                comparisonData.demographicEffects.professional.republican,
                comparisonData.demographicEffects.trust.republican,
                comparisonData.demographicEffects.discipline.republican,
              ],
              type: 'bar',
              name: 'Republican (vs Independent)',
              marker: { color: '#EF4444' },
            },
            {
              x: ['Appropriateness', 'Professionalism', 'Trust', 'Discipline'],
              y: [
                comparisonData.demographicEffects.appropriate.democrat,
                comparisonData.demographicEffects.professional.democrat,
                comparisonData.demographicEffects.trust.democrat,
                comparisonData.demographicEffects.discipline.democrat,
              ],
              type: 'bar',
              name: 'Democrat (vs Independent)',
              marker: { color: '#3B82F6' },
            },
          ]}
          layout={{
            ...chartLayout,
            height: 300,
            barmode: 'group',
            yaxis: {
              ...chartLayout.yaxis,
              title: 'Effect (coefficient)',
              zeroline: true,
              zerolinecolor: isDark ? '#6b7280' : '#9ca3af',
              zerolinewidth: 2,
            },
            legend: {
              orientation: 'h',
              y: -0.2,
              x: 0.5,
              xanchor: 'center',
            },
            shapes: [
              {
                type: 'line',
                x0: -0.5,
                x1: 3.5,
                y0: 0,
                y1: 0,
                line: { color: isDark ? '#6b7280' : '#9ca3af', width: 2 },
              },
            ],
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%', height: '300px' }}
        />

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong>Reading the chart:</strong> Republicans rate police profanity as more appropriate/professional
            and recommend less discipline compared to Independents. Democrats show the opposite pattern, rating
            profanity as less acceptable and recommending more discipline.
          </p>
        </div>
      </div>
    </div>
  );
}
