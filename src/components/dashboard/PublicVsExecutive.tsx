import { useState, useEffect, useMemo } from 'react';
import type { PlotParams } from 'react-plotly.js';
import { useDarkMode } from './hooks/useDarkMode';

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

interface Scenario {
  id: string;
  target: string;
  intent: string;
  quote: string;
  publicMeans: {
    appropriate: number;
    professional: number;
    trust: number;
    discipline: number;
  };
  executiveMeans: {
    appropriate: number;
    professional: number;
    trust: number;
    discipline: number;
  };
}

interface ScenariosData {
  scenarios: Scenario[];
}

const COLORS = {
  public: '#3B82F6',
  executive: '#10B981',
};

const TARGET_LABELS: Record<string, string> = {
  self: 'Self',
  colleague: 'Colleague',
  public: 'Public',
};

type Outcome = 'appropriate' | 'professional' | 'trust' | 'discipline';

export default function PublicVsExecutive() {
  const [scenariosData, setScenariosData] = useState<ScenariosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>('appropriate');
  const isDark = useDarkMode();

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/data/profanity/judgment-scenarios.json');
        if (!response.ok) throw new Error('Failed to fetch scenarios');
        const data = await response.json();
        setScenariosData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scenarios');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const groupedByTarget = useMemo(() => {
    if (!scenariosData) return null;

    const groups: Record<string, Scenario[]> = {
      self: [],
      colleague: [],
      public: [],
    };

    scenariosData.scenarios.forEach(s => {
      groups[s.target].push(s);
    });

    return groups;
  }, [scenariosData]);

  const avgDifferences = useMemo(() => {
    if (!scenariosData) return null;

    const outcomes: Outcome[] = ['appropriate', 'professional', 'trust', 'discipline'];
    const diffs: Record<Outcome, number> = {} as Record<Outcome, number>;

    outcomes.forEach(outcome => {
      const totalDiff = scenariosData.scenarios.reduce((sum, s) => {
        return sum + (s.executiveMeans[outcome] - s.publicMeans[outcome]);
      }, 0);
      diffs[outcome] = totalDiff / scenariosData.scenarios.length;
    });

    return diffs;
  }, [scenariosData]);

  const chartLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: isDark ? '#e5e7eb' : '#1f2937',
      family: 'Inter, system-ui, sans-serif',
    },
    margin: { l: 60, r: 30, t: 40, b: 80 },
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

  if (error || !scenariosData || !groupedByTarget || !avgDifferences) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg">
        <p className="text-red-700 dark:text-red-400">{error || 'Failed to load data'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key finding banner */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-2">Key Finding</h3>
        <p className="text-blue-100">
          Police executives are generally <strong>more accepting</strong> of profanity directed at self or colleagues,
          but equally condemn public-directed profanity. The gap narrows significantly when citizens are the target.
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

      {/* Summary stats */}
      <div className="grid md:grid-cols-4 gap-4" role="radiogroup" aria-label="Outcome statistic">
        {(['appropriate', 'professional', 'trust', 'discipline'] as Outcome[]).map(outcome => {
          const diff = avgDifferences[outcome];
          const isSelected = selectedOutcome === outcome;
          return (
            <button
              key={outcome}
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedOutcome(outcome)}
              className={`p-4 rounded-lg text-center transition-all ${
                isSelected
                  ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-600'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                {outcome}
              </div>
              <div className={`text-2xl font-bold ${
                diff > 0 ? 'text-green-600' : diff < 0 ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {diff > 0 ? '+' : ''}{diff.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                exec. vs public
              </div>
            </button>
          );
        })}
      </div>

      {/* Main comparison chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {selectedOutcome.charAt(0).toUpperCase() + selectedOutcome.slice(1)} by Target and Sample
        </h3>

        <PlotWrapper
          data={[
            {
              x: scenariosData.scenarios.map(s => `${TARGET_LABELS[s.target]} (${s.intent})`),
              y: scenariosData.scenarios.map(s => s.publicMeans[selectedOutcome]),
              type: 'bar',
              name: 'Public Sample (n=2,412)',
              marker: { color: COLORS.public },
            },
            {
              x: scenariosData.scenarios.map(s => `${TARGET_LABELS[s.target]} (${s.intent})`),
              y: scenariosData.scenarios.map(s => s.executiveMeans[selectedOutcome]),
              type: 'bar',
              name: 'Executives (n=1,492)',
              marker: { color: COLORS.executive },
            },
          ]}
          layout={{
            ...chartLayout,
            height: 400,
            barmode: 'group',
            yaxis: {
              ...chartLayout.yaxis,
              title: `Mean ${selectedOutcome.charAt(0).toUpperCase() + selectedOutcome.slice(1)} Rating`,
              range: [0, selectedOutcome === 'discipline' ? 3.5 : 4],
            },
            xaxis: {
              ...chartLayout.xaxis,
              tickangle: -45,
            },
            legend: {
              orientation: 'h',
              y: -0.3,
              x: 0.5,
              xanchor: 'center',
            },
            annotations: [
              {
                x: 2,
                y: selectedOutcome === 'discipline' ? 3.3 : 3.8,
                text: 'Self-directed',
                showarrow: false,
                font: { size: 10, color: isDark ? '#9ca3af' : '#6b7280' },
              },
              {
                x: 5,
                y: selectedOutcome === 'discipline' ? 3.3 : 3.8,
                text: 'Colleague-directed',
                showarrow: false,
                font: { size: 10, color: isDark ? '#9ca3af' : '#6b7280' },
              },
              {
                x: 8,
                y: selectedOutcome === 'discipline' ? 3.3 : 3.8,
                text: 'Public-directed',
                showarrow: false,
                font: { size: 10, color: isDark ? '#9ca3af' : '#6b7280' },
              },
            ],
            shapes: [
              { type: 'line', x0: 2.5, x1: 2.5, y0: 0, y1: selectedOutcome === 'discipline' ? 3.5 : 4, line: { dash: 'dot', color: isDark ? '#4b5563' : '#d1d5db' } },
              { type: 'line', x0: 5.5, x1: 5.5, y0: 0, y1: selectedOutcome === 'discipline' ? 3.5 : 4, line: { dash: 'dot', color: isDark ? '#4b5563' : '#d1d5db' } },
            ],
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%', height: '400px' }}
        />
      </div>

      {/* Heatmap of differences */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Difference Heatmap: Executive - Public
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Green = executives rate higher (more accepting); Blue = public rates higher
        </p>

        <PlotWrapper
          data={[
            {
              z: ['Self', 'Colleague', 'Public'].map(target =>
                ['Derogatory', 'Neutral', 'Positive'].map(intent => {
                  const scenario = scenariosData.scenarios.find(
                    s => s.target === target.toLowerCase() && s.intent === intent.toLowerCase()
                  );
                  return scenario
                    ? scenario.executiveMeans[selectedOutcome] - scenario.publicMeans[selectedOutcome]
                    : 0;
                })
              ),
              x: ['Derogatory', 'Neutral', 'Positive'],
              y: ['Self', 'Colleague', 'Public'],
              type: 'heatmap',
              colorscale: [
                [0, '#3B82F6'],
                [0.5, '#f5f5f5'],
                [1, '#10B981'],
              ],
              zmid: 0,
              zmin: -0.5,
              zmax: 0.5,
              showscale: true,
              colorbar: {
                title: 'Difference',
                titleside: 'right',
                tickvals: [-0.4, 0, 0.4],
                ticktext: ['Public higher', 'Equal', 'Exec. higher'],
              },
              hovertemplate: 'Target: %{y}<br>Intent: %{x}<br>Diff: %{z:.2f}<extra></extra>',
            },
          ]}
          layout={{
            ...chartLayout,
            height: 300,
            margin: { l: 80, r: 100, t: 20, b: 50 },
            xaxis: {
              ...chartLayout.xaxis,
              title: 'Intent',
            },
            yaxis: {
              ...chartLayout.yaxis,
              title: 'Target',
            },
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%', height: '300px' }}
        />
      </div>

      {/* Interpretation */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3">What This Means</h3>
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <p>
            <strong>Executives are more accepting of internal profanity:</strong> When profanity is directed
            at oneself or colleagues, police executives rate it as more appropriate and professional than the
            general public does.
          </p>
          <p>
            <strong>The gap closes for public-directed profanity:</strong> Both groups agree that using profanity
            toward citizens is inappropriate. Executives don't give their peers a pass when it comes to
            professional interactions with the public.
          </p>
          <p>
            <strong>Discipline recommendations diverge:</strong> While executives are somewhat less punitive
            for self/colleague profanity, they actually recommend <em>more</em> discipline than the public
            for derogatory language directed at citizens.
          </p>
        </div>
      </div>
    </div>
  );
}
