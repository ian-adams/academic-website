import { useState, useEffect, useMemo, useCallback } from 'react';
import type { PlotParams } from 'react-plotly.js';

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
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700"></div>
      </div>
    );
  }

  return <Plot {...props} />;
}

// Economist-style color palette
const COLORS = {
  red: '#E3120B',        // The Economist red
  darkRed: '#9B0000',
  navy: '#0D1F3C',
  slate: '#3D4F5F',
  warmGray: '#D4C5B9',
  gold: '#C9A227',
  teal: '#006D77',
  blue: '#1565C0',
};

// Bayesian calculation for FCWC risk
function calculateFCWCRisk(
  baseRateInnocent: number,  // P(Innocent|Confession) = 1 - P(Guilty|Confession)
  sensitivity: number,       // P(Tactic elicits confession | Guilty) - True positive rate
  specificity: number        // P(Tactic doesn't elicit | Innocent) - True negative rate
): number {
  // Using Bayes' theorem:
  // P(FCWC|Tactic) = P(Tactic|Innocent) * P(Innocent) / P(Tactic)
  // Where P(Tactic) = P(Tactic|Guilty)*P(Guilty) + P(Tactic|Innocent)*P(Innocent)

  const pInnocent = baseRateInnocent;
  const pGuilty = 1 - baseRateInnocent;

  const pTacticGivenInnocent = 1 - specificity;  // False positive rate
  const pTacticGivenGuilty = sensitivity;         // True positive rate

  const pTactic = (pTacticGivenGuilty * pGuilty) + (pTacticGivenInnocent * pInnocent);

  if (pTactic === 0) return 0;

  const pFCWC = (pTacticGivenInnocent * pInnocent) / pTactic;

  return pFCWC;
}

// Calculate acceptable risk threshold given lambda
function getAcceptableRisk(lambda: number): number {
  return 1 / (1 + lambda);
}

// Monte Carlo simulation for uncertainty
function runMonteCarloSimulation(
  baseRateMean: number,
  sensitivityMean: number,
  specificityMean: number,
  iterations: number = 1000,
  uncertainty: number = 0.05
): number[] {
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Add gaussian noise to parameters
    const baseRate = Math.max(0.001, Math.min(0.5, baseRateMean + (Math.random() - 0.5) * 2 * uncertainty * baseRateMean));
    const sens = Math.max(0.1, Math.min(0.99, sensitivityMean + (Math.random() - 0.5) * 2 * uncertainty));
    const spec = Math.max(0.1, Math.min(0.99, specificityMean + (Math.random() - 0.5) * 2 * uncertainty));

    results.push(calculateFCWCRisk(baseRate, sens, spec));
  }

  return results.sort((a, b) => a - b);
}

// Get percentile from sorted array
function getPercentile(sorted: number[], p: number): number {
  const index = Math.floor(p * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)];
}

export default function FCWCDashboard() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'acceptability' | 'about'>('calculator');
  const [isDark, setIsDark] = useState(false);

  // Calculator inputs
  const [baseRateGuilty, setBaseRateGuilty] = useState(0.95);  // P(Guilty|Confession)
  const [sensitivity, setSensitivity] = useState(0.83);        // From paper's minimization estimate
  const [specificity, setSpecificity] = useState(0.85);        // Conservative estimate

  // Acceptability curve inputs
  const [lambda, setLambda] = useState(10);  // Blackstone standard

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

  // Calculate FCWC risk
  const baseRateInnocent = 1 - baseRateGuilty;
  const fcwcRisk = useMemo(() =>
    calculateFCWCRisk(baseRateInnocent, sensitivity, specificity),
    [baseRateInnocent, sensitivity, specificity]
  );

  // Monte Carlo simulation
  const mcResults = useMemo(() =>
    runMonteCarloSimulation(baseRateInnocent, sensitivity, specificity, 2000),
    [baseRateInnocent, sensitivity, specificity]
  );

  const mc5th = getPercentile(mcResults, 0.05);
  const mc50th = getPercentile(mcResults, 0.50);
  const mc95th = getPercentile(mcResults, 0.95);

  // Acceptable risk threshold
  const acceptableThreshold = getAcceptableRisk(lambda);

  // Data for acceptability curve
  const acceptabilityCurveData = useMemo(() => {
    const lambdas = [];
    const thresholds = [];
    for (let l = 1; l <= 100; l++) {
      lambdas.push(l);
      thresholds.push(getAcceptableRisk(l) * 100);
    }
    return { lambdas, thresholds };
  }, []);

  // Sensitivity analysis data
  const sensitivityData = useMemo(() => {
    const specs = [0.70, 0.80, 0.90, 0.95, 0.99];
    const baseRates = [];
    const traces: { baseRate: number[]; risk: number[]; spec: number }[] = [];

    for (let br = 0.01; br <= 0.20; br += 0.01) {
      baseRates.push(br);
    }

    for (const spec of specs) {
      const risks = baseRates.map(br => calculateFCWCRisk(br, sensitivity, spec) * 100);
      traces.push({ baseRate: baseRates.map(b => b * 100), risk: risks, spec });
    }

    return { baseRates, traces };
  }, [sensitivity]);

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
      zerolinecolor: isDark ? '#4b5563' : '#d1d5db',
    },
    yaxis: {
      gridcolor: isDark ? '#374151' : '#e5e7eb',
      linecolor: isDark ? '#4b5563' : '#d1d5db',
      zerolinecolor: isDark ? '#4b5563' : '#d1d5db',
    },
  };

  return (
    <div className="min-h-screen">
      {/* Hero Header - Economist Style */}
      <header className="border-b-4 border-red-700 pb-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-12 bg-red-700"></div>
          <span className="text-sm font-bold tracking-widest uppercase text-red-700">
            Interactive Analysis
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 dark:text-white leading-tight mb-4">
          The Risk of False Confession<br />
          <span className="text-red-700">Wrongful Convictions</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl font-light leading-relaxed">
          A Bayesian framework for estimating how often lawful interrogation tactics
          contribute to wrongful convictions of the innocent.
        </p>
        <div className="flex items-center gap-6 mt-6 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-700 rounded-full"></span>
            Based on Adams, Mourtgos & Marier (forthcoming)
          </span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex border-b border-gray-200 dark:border-gray-700 mb-8">
        {[
          { id: 'calculator', label: 'Risk Calculator' },
          { id: 'acceptability', label: 'Acceptability Curve' },
          { id: 'about', label: 'The Framework' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-6 py-4 text-sm font-semibold tracking-wide uppercase transition-colors relative ${
              activeTab === tab.id
                ? 'text-red-700 dark:text-red-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-700"></div>
            )}
          </button>
        ))}
      </nav>

      {/* Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="space-y-8">
          {/* Key Result Banner */}
          <div className="bg-gray-900 dark:bg-gray-800 text-white p-8 -mx-4 sm:mx-0 sm:rounded-none">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8 items-center">
                <div className="md:col-span-2">
                  <div className="text-sm font-bold tracking-widest uppercase text-red-400 mb-2">
                    Posterior Probability
                  </div>
                  <div className="text-6xl md:text-7xl font-bold font-serif">
                    {(fcwcRisk * 100).toFixed(1)}%
                  </div>
                  <div className="text-lg text-gray-300 mt-2">
                    Estimated risk of FCWC given tactic use
                  </div>
                  <div className="text-sm text-gray-400 mt-4 font-mono">
                    90% CI: [{(mc5th * 100).toFixed(1)}% – {(mc95th * 100).toFixed(1)}%]
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-semibold px-4 py-2 rounded ${
                    fcwcRisk < acceptableThreshold
                      ? 'bg-teal-900/50 text-teal-300'
                      : 'bg-red-900/50 text-red-300'
                  }`}>
                    {fcwcRisk < acceptableThreshold ? 'Below' : 'Exceeds'} Threshold
                  </div>
                  <div className="text-sm text-gray-400 mt-2">
                    λ={lambda} threshold: {(acceptableThreshold * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parameter Controls */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Sliders Panel */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-red-700"></span>
                Model Parameters
              </h2>

              <div className="space-y-8">
                {/* Base Rate */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      P(Guilty | Confession)
                    </label>
                    <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
                      {(baseRateGuilty * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="0.99"
                    step="0.01"
                    value={baseRateGuilty}
                    onChange={(e) => setBaseRateGuilty(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>80%</span>
                    <span className="text-gray-400">Base rate of true confessions</span>
                    <span>99%</span>
                  </div>
                </div>

                {/* Sensitivity */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Sensitivity (True Positive Rate)
                    </label>
                    <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
                      {(sensitivity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.99"
                    step="0.01"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50%</span>
                    <span className="text-gray-400">P(Tactic works | Guilty)</span>
                    <span>99%</span>
                  </div>
                </div>

                {/* Specificity */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Specificity (True Negative Rate)
                    </label>
                    <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
                      {(specificity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.99"
                    step="0.01"
                    value={specificity}
                    onChange={(e) => setSpecificity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50%</span>
                    <span className="text-gray-400">P(No confession | Innocent)</span>
                    <span>99%</span>
                  </div>
                </div>

                {/* Lambda */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      λ (Harm Ratio)
                    </label>
                    <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
                      {lambda}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={lambda}
                    onChange={(e) => setLambda(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1</span>
                    <span className="text-gray-400">Blackstone standard = 10</span>
                    <span>50</span>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                  Presets from Literature
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Conservative', br: 0.95, sens: 0.83, spec: 0.85 },
                    { label: 'Moderate', br: 0.92, sens: 0.80, spec: 0.80 },
                    { label: 'Aggressive', br: 0.88, sens: 0.90, spec: 0.70 },
                    { label: 'Paper Default', br: 0.95, sens: 0.83, spec: 0.85 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setBaseRateGuilty(preset.br);
                        setSensitivity(preset.sens);
                        setSpecificity(preset.spec);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Monte Carlo Distribution */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-red-700"></span>
                Posterior Distribution
              </h2>

              <PlotWrapper
                data={[
                  {
                    x: mcResults.map(v => v * 100),
                    type: 'histogram',
                    nbinsx: 50,
                    marker: {
                      color: COLORS.red,
                      line: { color: isDark ? '#1f2937' : '#ffffff', width: 1 },
                    },
                    opacity: 0.8,
                    hovertemplate: 'Risk: %{x:.1f}%<br>Count: %{y}<extra></extra>',
                  },
                ]}
                layout={{
                  ...chartLayout,
                  height: 300,
                  showlegend: false,
                  xaxis: {
                    ...chartLayout.xaxis,
                    title: { text: 'FCWC Risk (%)', font: { size: 12 } },
                  },
                  yaxis: {
                    ...chartLayout.yaxis,
                    title: { text: 'Frequency', font: { size: 12 } },
                  },
                  shapes: [
                    {
                      type: 'line',
                      x0: acceptableThreshold * 100,
                      x1: acceptableThreshold * 100,
                      y0: 0,
                      y1: 1,
                      yref: 'paper',
                      line: { color: COLORS.teal, width: 2, dash: 'dash' },
                    },
                  ],
                  annotations: [
                    {
                      x: acceptableThreshold * 100,
                      y: 1,
                      yref: 'paper',
                      text: `λ=${lambda} threshold`,
                      showarrow: true,
                      arrowhead: 0,
                      ax: 40,
                      ay: -20,
                      font: { size: 10, color: COLORS.teal },
                    },
                  ],
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%', height: '300px' }}
              />

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6 text-center">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">5th %ile</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">{(mc5th * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Median</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">{(mc50th * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">95th %ile</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">{(mc95th * 100).toFixed(2)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sensitivity Analysis */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-red-700"></span>
              Sensitivity Analysis: How Specificity Affects Risk
            </h2>

            <PlotWrapper
              data={sensitivityData.traces.map((trace, i) => ({
                x: trace.baseRate,
                y: trace.risk,
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: `Spec=${(trace.spec * 100).toFixed(0)}%`,
                line: {
                  width: trace.spec === 0.85 ? 3 : 2,
                  color: [COLORS.warmGray, COLORS.slate, COLORS.navy, COLORS.red, COLORS.darkRed][i],
                  dash: trace.spec === specificity ? 'solid' : 'dot',
                },
              }))}
              layout={{
                ...chartLayout,
                height: 350,
                showlegend: true,
                legend: {
                  orientation: 'h',
                  y: -0.2,
                  x: 0.5,
                  xanchor: 'center',
                },
                xaxis: {
                  ...chartLayout.xaxis,
                  title: { text: 'Base Rate of False Confessions (%)', font: { size: 12 } },
                  range: [0, 20],
                },
                yaxis: {
                  ...chartLayout.yaxis,
                  title: { text: 'FCWC Risk (%)', font: { size: 12 } },
                },
                shapes: [
                  {
                    type: 'line',
                    x0: 0,
                    x1: 20,
                    y0: acceptableThreshold * 100,
                    y1: acceptableThreshold * 100,
                    line: { color: COLORS.teal, width: 2, dash: 'dash' },
                  },
                ],
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '350px' }}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
              Dashed teal line shows the acceptable risk threshold at λ={lambda} ({(acceptableThreshold * 100).toFixed(1)}%)
            </p>
          </div>
        </div>
      )}

      {/* Acceptability Curve Tab */}
      {activeTab === 'acceptability' && (
        <div className="space-y-8">
          {/* Explanation Banner */}
          <div className="bg-gray-900 dark:bg-gray-800 text-white p-8 -mx-4 sm:mx-0">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-serif font-bold mb-4">The Acceptability Curve</h2>
              <p className="text-lg text-gray-300 leading-relaxed">
                How much risk of wrongful conviction is "acceptable"? The answer depends on <strong className="text-white">λ (lambda)</strong>—the
                ratio of harm from wrongfully convicting an innocent person versus wrongfully acquitting a guilty one.
              </p>
              <div className="mt-6 p-4 bg-white/10 rounded-lg font-mono text-center">
                <span className="text-xl">Acceptable Risk = 1 / (1 + λ)</span>
              </div>
            </div>
          </div>

          {/* Lambda Selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <label className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Select Your λ Value
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={lambda}
                  onChange={(e) => setLambda(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-700 mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>λ=1 (equal harm)</span>
                  <span>λ=100 (strong protection)</span>
                </div>
              </div>
              <div className="text-center md:text-right">
                <div className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Your λ
                </div>
                <div className="text-5xl font-bold font-mono text-red-700">{lambda}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Max acceptable risk: <strong>{(acceptableThreshold * 100).toFixed(2)}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Lambda Standards Reference */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: 'Blackstone',
                lambda: 10,
                desc: '"Better that ten guilty persons escape than that one innocent suffer."',
                threshold: (getAcceptableRisk(10) * 100).toFixed(1),
              },
              {
                name: 'Volokh Empirical',
                lambda: 4.5,
                desc: 'Empirical estimate from survey research on public attitudes.',
                threshold: (getAcceptableRisk(4.5) * 100).toFixed(1),
              },
              {
                name: 'Fortescue',
                lambda: 20,
                desc: '"One would much rather that twenty guilty persons should escape...than one innocent person should be condemned."',
                threshold: (getAcceptableRisk(20) * 100).toFixed(1),
              },
            ].map((standard) => (
              <button
                key={standard.name}
                onClick={() => setLambda(standard.lambda)}
                className={`text-left p-6 border transition-all ${
                  lambda === standard.lambda
                    ? 'border-red-700 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {standard.name}
                  </span>
                  <span className="text-2xl font-bold font-mono text-red-700">
                    λ={standard.lambda}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-3">
                  {standard.desc}
                </p>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Threshold: {standard.threshold}%
                </div>
              </button>
            ))}
          </div>

          {/* Acceptability Curve Chart */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-red-700"></span>
              The Acceptability Curve
            </h2>

            <PlotWrapper
              data={[
                {
                  x: acceptabilityCurveData.lambdas,
                  y: acceptabilityCurveData.thresholds,
                  type: 'scatter',
                  mode: 'lines',
                  fill: 'tozeroy',
                  fillcolor: isDark ? 'rgba(227, 18, 11, 0.1)' : 'rgba(227, 18, 11, 0.1)',
                  line: { color: COLORS.red, width: 3 },
                  hovertemplate: 'λ=%{x}<br>Threshold=%{y:.1f}%<extra></extra>',
                },
                {
                  x: [lambda],
                  y: [acceptableThreshold * 100],
                  type: 'scatter',
                  mode: 'markers',
                  marker: { size: 16, color: COLORS.red, symbol: 'circle' },
                  name: 'Your selection',
                  hovertemplate: 'Your λ=%{x}<br>Threshold=%{y:.2f}%<extra></extra>',
                },
              ]}
              layout={{
                ...chartLayout,
                height: 400,
                showlegend: false,
                xaxis: {
                  ...chartLayout.xaxis,
                  title: { text: 'λ (Harm Ratio)', font: { size: 14, family: 'Inter' } },
                  range: [0, 100],
                },
                yaxis: {
                  ...chartLayout.yaxis,
                  title: { text: 'Maximum Acceptable FCWC Risk (%)', font: { size: 14, family: 'Inter' } },
                  range: [0, 55],
                },
                annotations: [
                  {
                    x: 10,
                    y: getAcceptableRisk(10) * 100,
                    text: 'Blackstone (λ=10)',
                    showarrow: true,
                    arrowhead: 0,
                    ax: 50,
                    ay: 20,
                    font: { size: 11 },
                  },
                  {
                    x: 20,
                    y: getAcceptableRisk(20) * 100,
                    text: 'Fortescue (λ=20)',
                    showarrow: true,
                    arrowhead: 0,
                    ax: 50,
                    ay: -20,
                    font: { size: 11 },
                  },
                ],
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '400px' }}
            />
          </div>

          {/* Key Insight */}
          <div className="bg-gray-100 dark:bg-gray-900 p-8 border-l-4 border-red-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Key Finding from the Research
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Under most reasonable assumptions about base rates and test characteristics, the posterior
              probability of a false confession wrongful conviction <strong>clusters around 1%</strong>.
              At the Blackstone standard (λ=10), the maximum tolerable risk is ~9.1%. This suggests that
              common interrogation tactics may fall within acceptable risk bounds—though the interpretation
              depends heavily on one's chosen value of λ.
            </p>
          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <span className="w-1 h-8 bg-red-700"></span>
              The Bayesian Framework
            </h2>

            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              This calculator implements a Bayesian inverse probability framework for estimating
              the risk of false confession wrongful convictions (FCWC) arising from lawful
              interrogation tactics like minimization.
            </p>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
              The Core Question
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              When police use lawful interrogation tactics that elicit a confession, what is the
              probability that this confession is false and leads to wrongful conviction?
            </p>

            <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg my-6 font-mono text-center">
              <div className="text-sm text-gray-500 mb-2">We want to find:</div>
              <div className="text-xl">P(FCWC | Tactic Used)</div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
              The Parameters
            </h3>

            <div className="space-y-4">
              <div className="border-l-4 border-red-700 pl-4">
                <h4 className="font-bold text-gray-900 dark:text-white">Base Rate: P(Guilty | Confession)</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  The probability that a confession is true. Literature suggests ~95% of confessions
                  lead to true convictions, implying a ~5% false confession base rate.
                </p>
              </div>

              <div className="border-l-4 border-red-700 pl-4">
                <h4 className="font-bold text-gray-900 dark:text-white">Sensitivity: P(Tactic Works | Guilty)</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  The probability that the tactic elicits a confession from a guilty suspect.
                  Estimated at ~83% for minimization tactics based on experimental research.
                </p>
              </div>

              <div className="border-l-4 border-red-700 pl-4">
                <h4 className="font-bold text-gray-900 dark:text-white">Specificity: P(No Confession | Innocent)</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  The probability that an innocent suspect does NOT falsely confess. Higher values
                  mean the tactic better protects the innocent.
                </p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
              The Acceptability Framework
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Rather than declaring any fixed risk "acceptable," the framework asks: given your
              values about the relative harms of wrongful conviction vs. wrongful acquittal,
              what risk level follows logically?
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              The parameter <strong>λ (lambda)</strong> captures this trade-off. The classic
              Blackstone formulation—"better that ten guilty persons escape than that one innocent
              suffer"—implies λ=10, yielding a maximum acceptable FCWC risk of 9.1%.
            </p>
          </div>

          {/* Citation */}
          <div className="bg-gray-50 dark:bg-gray-800 p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
              Citation
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Adams, I. T., Mourtgos, S. M., & Marier, C. J. (forthcoming). Recalibrating the Risk of
              False Confession Wrongful Convictions: A Bayesian Inverse Probability Simulation Approach.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div>
            Interactive analysis by{' '}
            <a href="https://ianadamsresearch.com" className="text-red-700 hover:underline">
              Ian T. Adams, Ph.D.
            </a>
            , University of South Carolina
          </div>
          <div className="text-xs">
            All results are for educational purposes. Assumptions and parameters significantly affect outcomes.
          </div>
        </div>
      </footer>
    </div>
  );
}
