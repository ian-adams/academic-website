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
  vignette: string;
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

const TARGETS = ['self', 'colleague', 'public'] as const;
const INTENTS = ['derogatory', 'neutral', 'positive'] as const;

const TARGET_LABELS: Record<string, string> = {
  self: 'Self/Situation',
  colleague: 'Colleague',
  public: 'Public',
};

const INTENT_LABELS: Record<string, string> = {
  derogatory: 'Derogatory',
  neutral: 'Neutral',
  positive: 'Positive',
};

const TARGET_COLORS: Record<string, string> = {
  self: '#10B981',
  colleague: '#F59E0B',
  public: '#EF4444',
};

const COLORS = {
  public: '#3B82F6',
  executive: '#10B981',
};

type Outcome = 'appropriate' | 'professional' | 'trust' | 'discipline';

export default function TargetIntentExplorer() {
  const [scenariosData, setScenariosData] = useState<ScenariosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTarget, setSelectedTarget] = useState<string>('self');
  const [selectedIntent, setSelectedIntent] = useState<string>('neutral');
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

  const selectedScenario = useMemo(() => {
    if (!scenariosData) return null;
    return scenariosData.scenarios.find(
      s => s.target === selectedTarget && s.intent === selectedIntent
    );
  }, [scenariosData, selectedTarget, selectedIntent]);

  const chartLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: isDark ? '#e5e7eb' : '#1f2937',
      family: 'Inter, system-ui, sans-serif',
    },
    margin: { l: 50, r: 30, t: 30, b: 50 },
    xaxis: {
      gridcolor: isDark ? '#374151' : '#e5e7eb',
      linecolor: isDark ? '#4b5563' : '#d1d5db',
    },
    yaxis: {
      gridcolor: isDark ? '#374151' : '#e5e7eb',
      linecolor: isDark ? '#4b5563' : '#d1d5db',
    },
  };

  const getInsight = () => {
    if (!selectedScenario) return '';

    const diff = selectedScenario.publicMeans[selectedOutcome] - selectedScenario.executiveMeans[selectedOutcome];
    const outcomeLabel = selectedOutcome.charAt(0).toUpperCase() + selectedOutcome.slice(1);

    if (selectedTarget === 'public') {
      return `Public-directed profanity consistently receives the harshest judgments from both groups. ${
        selectedOutcome === 'discipline'
          ? 'Both the public and executives recommend significant discipline for this type of language.'
          : 'This suggests a strong norm against using profanity when addressing citizens.'
      }`;
    }

    if (selectedIntent === 'positive' && selectedTarget !== 'public') {
      return `Positive intent somewhat mitigates negative reactions, though profanity is still viewed unfavorably overall. ${
        Math.abs(diff) > 0.2
          ? `Notably, ${diff > 0 ? 'executives are more accepting' : 'the public is more accepting'} of this usage.`
          : ''
      }`;
    }

    if (selectedIntent === 'derogatory') {
      return `Derogatory intent worsens judgments, particularly when directed at ${selectedTarget === 'colleague' ? 'colleagues' : 'oneself'}. ${
        selectedOutcome === 'discipline'
          ? 'Recommended discipline increases for derogatory language.'
          : ''
      }`;
    }

    return `Self-directed or neutral profanity is generally viewed as the most acceptable context for police profanity, though still not rated positively overall.`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (error || !scenariosData) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg">
        <p className="text-red-700 dark:text-red-400">{error || 'Failed to load data'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        {/* 3x3 Grid Selector */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
            Select Target × Intent
          </h3>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {INTENTS.map(intent => (
                    <th key={intent} className="p-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                      {INTENT_LABELS[intent]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TARGETS.map(target => (
                  <tr key={target}>
                    <td className="p-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                      {TARGET_LABELS[target]}
                    </td>
                    {INTENTS.map(intent => {
                      const scenario = scenariosData.scenarios.find(
                        s => s.target === target && s.intent === intent
                      );
                      const isSelected = selectedTarget === target && selectedIntent === intent;
                      const value = scenario?.publicMeans[selectedOutcome] || 0;

                      return (
                        <td key={intent} className="p-1">
                          <button
                            onClick={() => {
                              setSelectedTarget(target);
                              setSelectedIntent(intent);
                            }}
                            className={`w-full p-3 rounded-lg transition-all text-center ${
                              isSelected
                                ? 'ring-2 ring-purple-600 ring-offset-2 dark:ring-offset-gray-800'
                                : ''
                            }`}
                            style={{
                              backgroundColor: isSelected
                                ? TARGET_COLORS[target]
                                : isDark
                                ? '#374151'
                                : '#f3f4f6',
                              color: isSelected ? 'white' : isDark ? '#e5e7eb' : '#374151',
                            }}
                          >
                            <div className="text-2xl font-bold">{value.toFixed(2)}</div>
                            <div className="text-xs opacity-75">public</div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: TARGET_COLORS.self }}></span>
              Self (most acceptable)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: TARGET_COLORS.public }}></span>
              Public (least acceptable)
            </span>
          </div>
        </div>

        {/* Selected scenario details */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          {selectedScenario && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: TARGET_COLORS[selectedTarget] }}
                >
                  {TARGET_LABELS[selectedTarget]}
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {INTENT_LABELS[selectedIntent]}
                </span>
              </div>

              <blockquote className="border-l-4 border-purple-600 pl-4 mb-6">
                <p className="text-lg font-medium text-gray-900 dark:text-white italic">
                  "{selectedScenario.quote}"
                </p>
              </blockquote>

              {/* Comparison bars */}
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Public Sample</span>
                    <span className="font-semibold text-blue-600">
                      {selectedScenario.publicMeans[selectedOutcome].toFixed(2)}
                    </span>
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(selectedScenario.publicMeans[selectedOutcome] / 5) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Police Executives</span>
                    <span className="font-semibold text-green-600">
                      {selectedScenario.executiveMeans[selectedOutcome].toFixed(2)}
                    </span>
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(selectedScenario.executiveMeans[selectedOutcome] / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Insight callout */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Key Insight</h4>
                <p className="text-sm text-purple-700 dark:text-purple-400">
                  {getInsight()}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full comparison chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          All Scenarios: {selectedOutcome.charAt(0).toUpperCase() + selectedOutcome.slice(1)} Ratings
        </h3>

        <PlotWrapper
          data={[
            {
              x: scenariosData.scenarios.map(s => `${TARGET_LABELS[s.target]}\n(${INTENT_LABELS[s.intent]})`),
              y: scenariosData.scenarios.map(s => s.publicMeans[selectedOutcome]),
              type: 'bar',
              name: 'Public Sample',
              marker: { color: COLORS.public },
            },
            {
              x: scenariosData.scenarios.map(s => `${TARGET_LABELS[s.target]}\n(${INTENT_LABELS[s.intent]})`),
              y: scenariosData.scenarios.map(s => s.executiveMeans[selectedOutcome]),
              type: 'bar',
              name: 'Police Executives',
              marker: { color: COLORS.executive },
            },
          ]}
          layout={{
            ...chartLayout,
            height: 400,
            barmode: 'group',
            yaxis: {
              ...chartLayout.yaxis,
              title: `${selectedOutcome.charAt(0).toUpperCase() + selectedOutcome.slice(1)} Rating`,
              range: [0, selectedOutcome === 'discipline' ? 3.5 : 4],
            },
            xaxis: {
              ...chartLayout.xaxis,
              tickangle: -45,
            },
            legend: {
              orientation: 'h',
              y: -0.25,
              x: 0.5,
              xanchor: 'center',
            },
            shapes: selectedScenario ? [
              {
                type: 'rect',
                x0: scenariosData.scenarios.findIndex(
                  s => s.target === selectedTarget && s.intent === selectedIntent
                ) - 0.5,
                x1: scenariosData.scenarios.findIndex(
                  s => s.target === selectedTarget && s.intent === selectedIntent
                ) + 0.5,
                y0: 0,
                y1: selectedOutcome === 'discipline' ? 3.5 : 4,
                fillcolor: 'rgba(124, 58, 237, 0.1)',
                line: { width: 0 },
              },
            ] : [],
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%', height: '400px' }}
        />
      </div>
    </div>
  );
}
