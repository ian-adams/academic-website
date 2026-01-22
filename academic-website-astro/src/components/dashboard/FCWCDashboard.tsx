import { useState, useEffect, useMemo } from 'react';
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

// Tooltip component for technical terms
function Tooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <span className="relative group cursor-help border-b border-dotted border-gray-400">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none w-64 text-left z-50 shadow-lg">
        {tip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
      </span>
    </span>
  );
}

// Economist-style color palette
const COLORS = {
  red: '#E3120B',
  darkRed: '#9B0000',
  navy: '#0D1F3C',
  slate: '#3D4F5F',
  warmGray: '#D4C5B9',
  gold: '#C9A227',
  teal: '#006D77',
  blue: '#1565C0',
};

// Bayesian calculation for wrongful conviction risk
function calculateWrongfulConvictionRisk(
  baseRateInnocent: number,
  sensitivity: number,
  specificity: number
): number {
  const pInnocent = baseRateInnocent;
  const pGuilty = 1 - baseRateInnocent;
  const pTacticGivenInnocent = 1 - specificity;
  const pTacticGivenGuilty = sensitivity;
  const pTactic = (pTacticGivenGuilty * pGuilty) + (pTacticGivenInnocent * pInnocent);

  if (pTactic === 0) return 0;
  return (pTacticGivenInnocent * pInnocent) / pTactic;
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
  iterations: number = 2000,
  uncertainty: number = 0.05
): number[] {
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const baseRate = Math.max(0.001, Math.min(0.5, baseRateMean + (Math.random() - 0.5) * 2 * uncertainty * baseRateMean));
    const sens = Math.max(0.1, Math.min(0.99, sensitivityMean + (Math.random() - 0.5) * 2 * uncertainty));
    const spec = Math.max(0.1, Math.min(0.99, specificityMean + (Math.random() - 0.5) * 2 * uncertainty));
    results.push(calculateWrongfulConvictionRisk(baseRate, sens, spec));
  }

  return results.sort((a, b) => a - b);
}

function getPercentile(sorted: number[], p: number): number {
  const index = Math.floor(p * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)];
}

export default function FCWCDashboard() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'acceptability' | 'about'>('calculator');
  const [isDark, setIsDark] = useState(false);

  // Calculator inputs
  const [baseRateGuilty, setBaseRateGuilty] = useState(0.95);
  const [sensitivity, setSensitivity] = useState(0.83);
  const [specificity, setSpecificity] = useState(0.85);
  const [lambda, setLambda] = useState(10);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const baseRateInnocent = 1 - baseRateGuilty;
  const wrongfulConvictionRisk = useMemo(() =>
    calculateWrongfulConvictionRisk(baseRateInnocent, sensitivity, specificity),
    [baseRateInnocent, sensitivity, specificity]
  );

  const mcResults = useMemo(() =>
    runMonteCarloSimulation(baseRateInnocent, sensitivity, specificity, 2000),
    [baseRateInnocent, sensitivity, specificity]
  );

  const mc5th = getPercentile(mcResults, 0.05);
  const mc50th = getPercentile(mcResults, 0.50);
  const mc95th = getPercentile(mcResults, 0.95);

  const acceptableThreshold = getAcceptableRisk(lambda);

  // Static data for acceptability curve - computed once
  const acceptabilityCurveData = useMemo(() => {
    const lambdas: number[] = [];
    const thresholds: number[] = [];
    for (let l = 1; l <= 100; l++) {
      lambdas.push(l);
      thresholds.push(getAcceptableRisk(l) * 100);
    }
    return { lambdas, thresholds };
  }, []);

  // Sensitivity analysis data
  const sensitivityData = useMemo(() => {
    const specs = [0.70, 0.80, 0.90, 0.95, 0.99];
    const traces: { baseRate: number[]; risk: number[]; spec: number }[] = [];

    for (const spec of specs) {
      const baseRates: number[] = [];
      const risks: number[] = [];
      for (let br = 0.01; br <= 0.20; br += 0.01) {
        baseRates.push(br * 100);
        risks.push(calculateWrongfulConvictionRisk(br, sensitivity, spec) * 100);
      }
      traces.push({ baseRate: baseRates, risk: risks, spec });
    }

    return { traces };
  }, [sensitivity]);

  // Dynamic interpretation of results
  const getInterpretation = () => {
    const riskPct = wrongfulConvictionRisk * 100;
    const thresholdPct = acceptableThreshold * 100;

    if (riskPct < 1) {
      return `With these assumptions, fewer than 1 in 100 confessions obtained using this tactic would be false and lead to wrongful conviction.`;
    } else if (riskPct < 5) {
      return `With these assumptions, roughly ${riskPct.toFixed(0)} in 100 confessions obtained using this tactic would be false and lead to wrongful conviction.`;
    } else {
      return `With these assumptions, about ${riskPct.toFixed(0)} in 100 confessions obtained using this tactic would be false and lead to wrongful conviction—a relatively high rate.`;
    }
  };

  const getThresholdInterpretation = () => {
    const riskPct = wrongfulConvictionRisk * 100;
    const thresholdPct = acceptableThreshold * 100;

    if (wrongfulConvictionRisk < acceptableThreshold) {
      const margin = thresholdPct - riskPct;
      return `This is ${margin.toFixed(1)} percentage points below your chosen acceptability threshold of ${thresholdPct.toFixed(1)}%.`;
    } else {
      const excess = riskPct - thresholdPct;
      return `This exceeds your chosen acceptability threshold of ${thresholdPct.toFixed(1)}% by ${excess.toFixed(1)} percentage points.`;
    }
  };

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
      {/* Hero Header */}
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
            Based on{' '}
            <a href="https://smourtgos.netlify.app/" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">
              Mourtgos
            </a>
            {' & Adams, forthcoming at <em>Journal of Criminal Justice</em>'}
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
          <div className="bg-gray-900 dark:bg-gray-800 text-white p-8 -mx-4 sm:mx-0">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8 items-center">
                <div className="md:col-span-2">
                  <div className="text-sm font-bold tracking-widest uppercase text-red-400 mb-2">
                    Estimated Wrongful Conviction Risk
                  </div>
                  <div className="text-6xl md:text-7xl font-bold font-serif">
                    {(wrongfulConvictionRisk * 100).toFixed(1)}%
                  </div>
                  <div className="text-lg text-gray-300 mt-3 leading-relaxed">
                    {getInterpretation()}
                  </div>
                  <div className="text-sm text-gray-400 mt-4 font-mono">
                    90% confidence interval: {(mc5th * 100).toFixed(1)}% – {(mc95th * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-semibold px-4 py-2 rounded ${
                    wrongfulConvictionRisk < acceptableThreshold
                      ? 'bg-teal-900/50 text-teal-300'
                      : 'bg-red-900/50 text-red-300'
                  }`}>
                    {wrongfulConvictionRisk < acceptableThreshold ? 'Within' : 'Exceeds'} Acceptable Range
                  </div>
                  <div className="text-sm text-gray-400 mt-2">
                    Your threshold (λ={lambda}): {(acceptableThreshold * 100).toFixed(1)}%
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
                Adjust Your Assumptions
              </h2>

              <div className="space-y-8">
                {/* Base Rate */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <Tooltip tip="What percentage of confessions are from truly guilty people? Higher values mean confessions are more reliable indicators of guilt.">
                        True Confession Rate
                      </Tooltip>
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
                    <span>80% (more false confessions)</span>
                    <span>99% (very reliable)</span>
                  </div>
                </div>

                {/* Sensitivity */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <Tooltip tip="How effective is the tactic at getting guilty people to confess? Higher values mean the tactic is more effective at eliciting true confessions.">
                        Tactic Effectiveness (Guilty)
                      </Tooltip>
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
                    <span>50% (less effective)</span>
                    <span>99% (highly effective)</span>
                  </div>
                </div>

                {/* Specificity */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <Tooltip tip="How well does the tactic protect innocent people from falsely confessing? Higher values mean innocent people are less likely to falsely confess under this tactic.">
                        Innocent Protection Rate
                      </Tooltip>
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
                    <span>50% (risky for innocents)</span>
                    <span>99% (protects innocents)</span>
                  </div>
                </div>

                {/* Lambda */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <Tooltip tip="How many guilty people going free equals the harm of one innocent person wrongly convicted? Higher values mean you place more weight on protecting the innocent.">
                        Harm Trade-off (λ)
                      </Tooltip>
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
                    <span>1 (equal weight)</span>
                    <span>10 = Blackstone</span>
                    <span>50 (protect innocent)</span>
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
                    { label: 'Conservative (Paper Default)', br: 0.95, sens: 0.83, spec: 0.85 },
                    { label: 'Moderate', br: 0.92, sens: 0.80, spec: 0.80 },
                    { label: 'Pessimistic', br: 0.88, sens: 0.90, spec: 0.70 },
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

            {/* Results Panel */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-red-700"></span>
                What Your Choices Mean
              </h2>

              {/* Dynamic interpretation */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {getInterpretation()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  {getThresholdInterpretation()}
                </p>
              </div>

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
                  height: 220,
                  showlegend: false,
                  xaxis: {
                    ...chartLayout.xaxis,
                    title: { text: 'Wrongful Conviction Risk (%)', font: { size: 11 } },
                  },
                  yaxis: {
                    ...chartLayout.yaxis,
                    title: { text: 'Frequency', font: { size: 11 } },
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
                      text: `Your threshold`,
                      showarrow: true,
                      arrowhead: 0,
                      ax: 40,
                      ay: -20,
                      font: { size: 10, color: COLORS.teal },
                    },
                  ],
                }}
                config={{ responsive: true, displayModeBar: false, staticPlot: true }}
                style={{ width: '100%', height: '220px' }}
              />

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Low Est.</div>
                  <div className="text-lg font-bold font-mono text-gray-900 dark:text-white">{(mc5th * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Middle</div>
                  <div className="text-lg font-bold font-mono text-gray-900 dark:text-white">{(mc50th * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">High Est.</div>
                  <div className="text-lg font-bold font-mono text-gray-900 dark:text-white">{(mc95th * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sensitivity Analysis */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="w-1 h-6 bg-red-700"></span>
              How Protection Rates Change the Picture
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This chart shows how the wrongful conviction risk changes based on how well the tactic protects innocent people (different lines) and the underlying rate of false confessions (x-axis).
            </p>

            <PlotWrapper
              data={sensitivityData.traces.map((trace, i) => ({
                x: trace.baseRate,
                y: trace.risk,
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: `${(trace.spec * 100).toFixed(0)}% protection`,
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
                  title: { text: 'False Confession Rate (%)', font: { size: 12 } },
                  range: [0, 20],
                },
                yaxis: {
                  ...chartLayout.yaxis,
                  title: { text: 'Wrongful Conviction Risk (%)', font: { size: 12 } },
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
              config={{ responsive: true, displayModeBar: false, staticPlot: true }}
              style={{ width: '100%', height: '350px' }}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
              Dashed teal line = your acceptability threshold ({(acceptableThreshold * 100).toFixed(1)}%). Solid line = your current protection rate setting.
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
                How much risk of wrongful conviction is "acceptable"? There's no single answer—it depends on
                how you weigh the harm of convicting an innocent person against the harm of letting a guilty person go free.
              </p>
              <div className="mt-6 p-4 bg-white/10 rounded-lg">
                <div className="text-center font-mono text-xl mb-2">
                  Maximum Acceptable Risk = 1 ÷ (1 + λ)
                </div>
                <p className="text-sm text-gray-400 text-center">
                  Where λ represents how many guilty people going free equals the harm of one wrongful conviction
                </p>
              </div>
            </div>
          </div>

          {/* Lambda Selector with better explanation */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                What's Your Trade-off?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                The value <strong>λ (lambda)</strong> represents a moral judgment: How many guilty people going free
                is equivalent in harm to one innocent person being wrongly convicted? A higher λ means you believe
                wrongful convictions are much worse than wrongful acquittals, so you'll tolerate less risk.
              </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <label className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Slide to set your λ value
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
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <div className="text-left">
                    <div className="font-semibold">λ = 1</div>
                    <div>Equal weight to both errors</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">λ = 10</div>
                    <div>Blackstone's ratio</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">λ = 100</div>
                    <div>Strong protection for innocent</div>
                  </div>
                </div>
              </div>
              <div className="text-center md:text-right md:ml-8">
                <div className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Your λ
                </div>
                <div className="text-5xl font-bold font-mono text-red-700">{lambda}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Max acceptable risk: <strong>{(acceptableThreshold * 100).toFixed(2)}%</strong>
                </div>
              </div>
            </div>

            {/* Plain language interpretation */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Your choice means:</strong> You believe that {lambda} guilty {lambda === 1 ? 'person' : 'people'} going free
                is about as harmful as one innocent person being wrongly convicted. Therefore, you'd accept a wrongful
                conviction risk of up to {(acceptableThreshold * 100).toFixed(1)}%.
              </p>
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
                name: 'Volokh (Empirical)',
                lambda: 4.5,
                desc: 'Based on survey research asking people about their actual preferences.',
                threshold: (getAcceptableRisk(4.5) * 100).toFixed(1),
              },
              {
                name: 'Fortescue',
                lambda: 20,
                desc: '"One would much rather that twenty guilty persons should escape..."',
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
            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="w-1 h-6 bg-red-700"></span>
              The Acceptability Curve
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              As λ increases (more weight on protecting the innocent), the maximum acceptable risk decreases rapidly at first, then levels off.
            </p>

            <PlotWrapper
              key={`acceptability-curve-${lambda}`}
              data={[
                {
                  x: acceptabilityCurveData.lambdas,
                  y: acceptabilityCurveData.thresholds,
                  type: 'scatter',
                  mode: 'lines',
                  fill: 'tozeroy',
                  fillcolor: isDark ? 'rgba(227, 18, 11, 0.1)' : 'rgba(227, 18, 11, 0.1)',
                  line: { color: COLORS.red, width: 3 },
                  hovertemplate: 'λ=%{x}<br>Max Risk=%{y:.1f}%<extra></extra>',
                  name: 'Acceptable risk',
                },
                {
                  x: [lambda],
                  y: [acceptableThreshold * 100],
                  type: 'scatter',
                  mode: 'markers+text',
                  marker: { size: 16, color: COLORS.red, symbol: 'circle' },
                  text: [`You: ${(acceptableThreshold * 100).toFixed(1)}%`],
                  textposition: 'top center',
                  textfont: { size: 12, color: isDark ? '#e5e7eb' : '#1f2937' },
                  hovertemplate: 'Your λ=%{x}<br>Max Risk=%{y:.2f}%<extra></extra>',
                  name: 'Your selection',
                },
              ]}
              layout={{
                ...chartLayout,
                height: 400,
                showlegend: false,
                xaxis: {
                  ...chartLayout.xaxis,
                  title: { text: 'λ (Your Harm Trade-off Value)', font: { size: 14 } },
                  range: [0, 105],
                  fixedrange: true,
                },
                yaxis: {
                  ...chartLayout.yaxis,
                  title: { text: 'Maximum Acceptable Risk (%)', font: { size: 14 } },
                  range: [0, 55],
                  fixedrange: true,
                },
                annotations: [
                  {
                    x: 10,
                    y: getAcceptableRisk(10) * 100,
                    text: 'Blackstone',
                    showarrow: true,
                    arrowhead: 0,
                    ax: 40,
                    ay: 25,
                    font: { size: 10 },
                  },
                ],
              }}
              config={{ responsive: true, displayModeBar: false, staticPlot: true }}
              style={{ width: '100%', height: '400px' }}
            />
          </div>

          {/* Key Insight */}
          <div className="bg-gray-100 dark:bg-gray-900 p-8 border-l-4 border-red-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Key Finding from the Research
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Under most reasonable assumptions, the estimated risk of a false confession leading to wrongful
              conviction <strong>clusters around 1%</strong>. At the traditional Blackstone standard (λ=10),
              the maximum acceptable risk is about 9%. This suggests common interrogation tactics may fall
              within acceptable bounds—but your conclusion depends on your choice of λ.
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
              This calculator uses Bayesian probability to estimate the risk that lawful
              interrogation tactics contribute to wrongful convictions of innocent people.
            </p>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
              The Core Question
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              When police use an interrogation tactic and obtain a confession, what's the chance
              that confession is false and leads to wrongful conviction?
            </p>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
              The Three Key Inputs
            </h3>

            <div className="space-y-4">
              <div className="border-l-4 border-red-700 pl-4">
                <h4 className="font-bold text-gray-900 dark:text-white">True Confession Rate</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  What percentage of confessions come from actually guilty people? Research suggests
                  about 95% of confessions are true, meaning about 5% are false.
                </p>
              </div>

              <div className="border-l-4 border-red-700 pl-4">
                <h4 className="font-bold text-gray-900 dark:text-white">Tactic Effectiveness</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  How good is the tactic at getting guilty people to confess? Experimental research
                  suggests tactics like minimization work about 83% of the time on guilty suspects.
                </p>
              </div>

              <div className="border-l-4 border-red-700 pl-4">
                <h4 className="font-bold text-gray-900 dark:text-white">Innocent Protection Rate</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  How well does the tactic protect innocent people from falsely confessing? Higher
                  values mean innocent people are less likely to falsely confess.
                </p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
              The Acceptability Question
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Rather than declaring any fixed risk "acceptable," the framework asks: given how you
              personally weigh the harm of wrongful conviction versus wrongful acquittal, what risk
              level is logically acceptable?
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              The classic Blackstone formulation—"better that ten guilty persons escape than that one
              innocent suffer"—implies a λ of 10, meaning wrongful conviction is 10× worse than
              wrongful acquittal. This yields a maximum acceptable risk of about 9%.
            </p>
          </div>

          {/* Citation */}
          <div className="bg-gray-50 dark:bg-gray-800 p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
              Citation
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Mourtgos, S. M., & Adams, I. T. (forthcoming). Recalibrating the Risk of
              False Confession Wrongful Convictions: A Bayesian Inverse Probability Simulation Approach.
              <em> Journal of Criminal Justice</em>.
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
            All results are for educational purposes. Your assumptions significantly affect the outcomes.
          </div>
        </div>
      </footer>
    </div>
  );
}
