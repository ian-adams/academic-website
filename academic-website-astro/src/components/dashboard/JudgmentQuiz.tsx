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
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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

interface Scale {
  label: string;
  question: string;
  anchors: string[];
}

interface ScenariosData {
  scenarios: Scenario[];
  scales: Record<string, Scale>;
}

interface UserRatings {
  appropriate: number;
  professional: number;
  trust: number;
  discipline: number;
}

const COLORS = {
  user: '#7C3AED',
  public: '#3B82F6',
  executive: '#10B981',
};

export default function JudgmentQuiz() {
  const [scenariosData, setScenariosData] = useState<ScenariosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentScenario, setCurrentScenario] = useState(0);
  const [userRatings, setUserRatings] = useState<Record<string, UserRatings>>({});
  const [currentRatings, setCurrentRatings] = useState<Partial<UserRatings>>({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
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

  const startQuiz = () => {
    setCurrentScenario(0);
    setUserRatings({});
    setCurrentRatings({});
    setQuizComplete(false);
    setQuizStarted(true);
  };

  const handleRating = (scale: keyof UserRatings, value: number) => {
    setCurrentRatings(prev => ({ ...prev, [scale]: value }));
  };

  const isCurrentComplete = () => {
    return (
      currentRatings.appropriate !== undefined &&
      currentRatings.professional !== undefined &&
      currentRatings.trust !== undefined &&
      currentRatings.discipline !== undefined
    );
  };

  const nextScenario = () => {
    if (!scenariosData || !isCurrentComplete()) return;

    const scenario = scenariosData.scenarios[currentScenario];
    setUserRatings(prev => ({
      ...prev,
      [scenario.id]: currentRatings as UserRatings
    }));

    if (currentScenario < scenariosData.scenarios.length - 1) {
      setCurrentScenario(prev => prev + 1);
      setCurrentRatings({});
    } else {
      setQuizComplete(true);
    }
  };

  const averageUserRatings = useMemo(() => {
    const ratings = Object.values(userRatings);
    if (ratings.length === 0) return null;

    return {
      appropriate: ratings.reduce((sum, r) => sum + r.appropriate, 0) / ratings.length,
      professional: ratings.reduce((sum, r) => sum + r.professional, 0) / ratings.length,
      trust: ratings.reduce((sum, r) => sum + r.trust, 0) / ratings.length,
      discipline: ratings.reduce((sum, r) => sum + r.discipline, 0) / ratings.length,
    };
  }, [userRatings]);

  const averagePublicRatings = useMemo(() => {
    if (!scenariosData) return null;
    const scenarios = scenariosData.scenarios;
    return {
      appropriate: scenarios.reduce((sum, s) => sum + s.publicMeans.appropriate, 0) / scenarios.length,
      professional: scenarios.reduce((sum, s) => sum + s.publicMeans.professional, 0) / scenarios.length,
      trust: scenarios.reduce((sum, s) => sum + s.publicMeans.trust, 0) / scenarios.length,
      discipline: scenarios.reduce((sum, s) => sum + s.publicMeans.discipline, 0) / scenarios.length,
    };
  }, [scenariosData]);

  const chartLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: isDark ? '#e5e7eb' : '#1f2937',
      family: 'Inter, system-ui, sans-serif',
    },
    margin: { l: 60, r: 30, t: 40, b: 60 },
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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Start screen
  if (!quizStarted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-4">
            The Judgment Quiz
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You'll read 9 scenarios of police officers using profanity in different contexts.
            For each one, rate the language on four dimensions. Then see how your judgments
            compare to a nationally representative sample.
          </p>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">You'll rate each scenario on:</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• <strong>Appropriateness</strong> - How appropriate was the language?</li>
              <li>• <strong>Professionalism</strong> - How professional was the language?</li>
              <li>• <strong>Trust</strong> - How would this affect your trust in police?</li>
              <li>• <strong>Discipline</strong> - What discipline, if any, should the officer receive?</li>
            </ul>
          </div>

          <button
            onClick={startQuiz}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg rounded-lg transition-colors"
          >
            Start the Quiz
          </button>
        </div>
      </div>
    );
  }

  // Results screen
  if (quizComplete && scenariosData && averageUserRatings && averagePublicRatings) {
    const scaleLabels = ['Appropriateness', 'Professionalism', 'Trust', 'Discipline'];
    const scaleKeys: (keyof UserRatings)[] = ['appropriate', 'professional', 'trust', 'discipline'];

    return (
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8">
          <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-2 text-center">
            Your Results
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            See how your judgments compare to the national sample (n=1,012)
          </p>

          {/* Overall comparison chart */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Average Ratings Across All Scenarios
            </h3>
            <PlotWrapper
              data={[
                {
                  x: scaleLabels,
                  y: scaleKeys.map(k => averageUserRatings[k]),
                  type: 'bar',
                  name: 'Your Ratings',
                  marker: { color: COLORS.user },
                },
                {
                  x: scaleLabels,
                  y: scaleKeys.map(k => averagePublicRatings[k]),
                  type: 'bar',
                  name: 'National Sample',
                  marker: { color: COLORS.public },
                },
              ]}
              layout={{
                ...chartLayout,
                height: 350,
                barmode: 'group',
                yaxis: {
                  ...chartLayout.yaxis,
                  title: 'Rating (1-5)',
                  range: [0, 5.5],
                },
                legend: {
                  orientation: 'h',
                  y: -0.15,
                  x: 0.5,
                  xanchor: 'center',
                },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '350px' }}
            />
          </div>

          {/* Interpretation */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 mb-8">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">What Your Ratings Suggest</h3>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {averageUserRatings.appropriate > averagePublicRatings.appropriate + 0.3 && (
                <p>• You rated police profanity as <strong>more appropriate</strong> than the average American.</p>
              )}
              {averageUserRatings.appropriate < averagePublicRatings.appropriate - 0.3 && (
                <p>• You rated police profanity as <strong>less appropriate</strong> than the average American.</p>
              )}
              {Math.abs(averageUserRatings.appropriate - averagePublicRatings.appropriate) <= 0.3 && (
                <p>• Your views on appropriateness are <strong>similar to</strong> the average American.</p>
              )}
              {averageUserRatings.discipline > averagePublicRatings.discipline + 0.3 && (
                <p>• You recommended <strong>more discipline</strong> than the average American.</p>
              )}
              {averageUserRatings.discipline < averagePublicRatings.discipline - 0.3 && (
                <p>• You recommended <strong>less discipline</strong> than the average American.</p>
              )}
            </div>
          </div>

          {/* Per-scenario breakdown */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Scenario-by-Scenario Comparison
            </h3>
            <div className="space-y-4">
              {scenariosData.scenarios.map(scenario => {
                const userR = userRatings[scenario.id];
                if (!userR) return null;

                return (
                  <div
                    key={scenario.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        scenario.target === 'public'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : scenario.target === 'colleague'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {scenario.target}
                      </span>
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {scenario.intent}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      "{scenario.quote}"
                    </p>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {scaleKeys.map((key, i) => (
                        <div key={key} className="text-center">
                          <div className="text-gray-500 dark:text-gray-400 mb-1">{scaleLabels[i]}</div>
                          <div className="flex justify-center gap-1">
                            <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                              {userR[key].toFixed(1)}
                            </span>
                            <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                              {scenario.publicMeans[key].toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-600"></span> Your rating
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-600"></span> National sample
              </span>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={startQuiz}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Take Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active quiz
  if (!scenariosData) return null;
  const scenario = scenariosData.scenarios[currentScenario];
  const scales = scenariosData.scales;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>Scenario {currentScenario + 1} of {scenariosData.scenarios.length}</span>
          <span className="flex gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              scenario.target === 'public'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                : scenario.target === 'colleague'
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            }`}>
              Target: {scenario.target}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              Intent: {scenario.intent}
            </span>
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${((currentScenario + 1) / scenariosData.scenarios.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Vignette */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Read this scenario:
          </h3>
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
            {scenario.vignette}
          </p>
        </div>

        {/* Rating scales */}
        <div className="p-6 space-y-8">
          {Object.entries(scales).map(([key, scale]) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {scale.question}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-28 text-right">
                  {scale.anchors[0]}
                </span>
                <div className="flex-1 flex justify-between">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      onClick={() => handleRating(key as keyof UserRatings, value)}
                      className={`w-12 h-12 rounded-lg font-bold text-lg transition-all ${
                        currentRatings[key as keyof UserRatings] === value
                          ? 'bg-purple-600 text-white scale-110'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 w-28">
                  {scale.anchors[1]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Next button */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={nextScenario}
            disabled={!isCurrentComplete()}
            className={`w-full py-3 font-semibold rounded-lg transition-colors ${
              isCurrentComplete()
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {currentScenario < scenariosData.scenarios.length - 1 ? 'Next Scenario' : 'See Results'}
          </button>
          {!isCurrentComplete() && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              Please rate all four dimensions to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
