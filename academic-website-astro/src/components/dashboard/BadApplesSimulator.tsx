import { useState, useEffect, useMemo, useCallback } from 'react';
import { DARK_LAYOUT, LIGHT_LAYOUT } from './types';
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 dark:border-primary-400"></div>
      </div>
    );
  }

  return <Plot {...props} />;
}

// Types for the simulator
interface SimulationParams {
  numOfficers: number;
  numComplaints: number;
  topPercentile: number;
  replacementStrategy: 'median' | 'p70_90' | 'same_district_median' | 'same_district_p70_90';
  probationMonths: number;
}

interface ConcentrationData {
  percentiles: number[];
  actual: number[];
  simulated: number[];
  uniform: number[];
}

interface PersistenceCell {
  prePercentile: number;
  postPercentile: number;
  value: number;
}

// Synthetic data generator based on Chalfin & Kaplan parameters
function generateSyntheticOfficerData(
  numOfficers: number,
  numComplaints: number,
  concentrationFactor: number = 2.5
): number[] {
  // Generate complaints with realistic concentration
  // Use negative binomial-like distribution to create natural clustering
  const complaints = new Array(numOfficers).fill(0);

  // Assign base risk to each officer (some are higher risk)
  const risks = new Array(numOfficers).fill(0).map(() => {
    // Most officers low risk, some medium, few high
    const r = Math.random();
    if (r < 0.7) return 0.5; // 70% low risk
    if (r < 0.95) return 1.5; // 25% medium risk
    return concentrationFactor * 2; // 5% high risk
  });

  // Normalize risks to create probability distribution
  const totalRisk = risks.reduce((a, b) => a + b, 0);
  const probs = risks.map(r => r / totalRisk);

  // Assign complaints based on risk probabilities
  for (let i = 0; i < numComplaints; i++) {
    const rand = Math.random();
    let cumProb = 0;
    for (let j = 0; j < numOfficers; j++) {
      cumProb += probs[j];
      if (rand <= cumProb) {
        complaints[j]++;
        break;
      }
    }
  }

  return complaints;
}

// Monte Carlo simulation for null distribution
function simulateRandomConcentration(
  numOfficers: number,
  numComplaints: number,
  iterations: number = 200
): number[] {
  const percentileResults: number[][] = [];

  for (let iter = 0; iter < iterations; iter++) {
    const complaints = new Array(numOfficers).fill(0);

    // Randomly assign complaints
    for (let i = 0; i < numComplaints; i++) {
      const idx = Math.floor(Math.random() * numOfficers);
      complaints[idx]++;
    }

    // Sort descending
    complaints.sort((a, b) => b - a);

    // Calculate cumulative share at each percentile
    const total = numComplaints;
    let cumSum = 0;
    const cumShares: number[] = [];

    for (let i = 0; i < numOfficers; i++) {
      cumSum += complaints[i];
      cumShares.push(cumSum / total);
    }

    percentileResults.push(cumShares);
  }

  // Average across iterations
  const avgShares: number[] = new Array(numOfficers).fill(0);
  for (let i = 0; i < numOfficers; i++) {
    for (let iter = 0; iter < iterations; iter++) {
      avgShares[i] += percentileResults[iter][i] / iterations;
    }
  }

  return avgShares;
}

// Calculate concentration curve from complaint data
function calculateConcentration(complaints: number[]): number[] {
  const sorted = [...complaints].sort((a, b) => b - a);
  const total = sorted.reduce((a, b) => a + b, 0);

  if (total === 0) return sorted.map(() => 0);

  let cumSum = 0;
  return sorted.map(c => {
    cumSum += c;
    return cumSum / total;
  });
}

// Calculate relative risk ratio
function calculateRelativeRisk(shareTop: number, percentile: number): number {
  const k = percentile;
  const share = shareTop * 100;

  if (k === 0 || k === 100) return 0;

  const rateTop = share / k;
  const rateRest = (100 - share) / (100 - k);

  return rateRest > 0 ? rateTop / rateRest : 0;
}

// Generate persistence matrix data (synthetic based on paper's Table 1)
function generatePersistenceData(probationMonths: number): PersistenceCell[] {
  // Values loosely based on Chalfin & Kaplan Table 1
  // Longer probation = better prediction
  const factor = probationMonths >= 60 ? 1.5 : 1.0;

  const baseMatrix: Record<string, Record<string, number>> = {
    '2': { '2': 2.0 * factor, '5': 8.0 * factor, '10': 18.0 * factor, '20': 37.0 * factor },
    '5': { '2': 3.5 * factor, '5': 12.0 * factor, '10': 22.0 * factor, '20': 35.0 * factor },
    '10': { '2': 3.4 * factor, '5': 8.5 * factor, '10': 17.0 * factor, '20': 28.0 * factor },
    '20': { '2': 3.0 * factor, '5': 8.3 * factor, '10': 15.0 * factor, '20': 26.0 * factor },
  };

  const cells: PersistenceCell[] = [];
  const percentiles = [2, 5, 10, 20];

  for (const pre of percentiles) {
    for (const post of percentiles) {
      cells.push({
        prePercentile: pre,
        postPercentile: post,
        value: Math.min(baseMatrix[pre.toString()][post.toString()], 100),
      });
    }
  }

  return cells;
}

// Policy simulation: estimate complaint reduction
function simulatePolicyImpact(
  params: SimulationParams,
  iterations: number = 100
): { mean: number; ci: [number, number] } {
  const results: number[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    // Generate pre-period complaints
    const preComplaints = generateSyntheticOfficerData(
      params.numOfficers,
      Math.floor(params.numComplaints * (params.probationMonths / 120))
    );

    // Identify top k% based on pre-period
    const indexed = preComplaints.map((c, i) => ({ complaints: c, index: i }));
    indexed.sort((a, b) => b.complaints - a.complaints);

    const numToRemove = Math.floor(params.numOfficers * (params.topPercentile / 100));
    const removedIndices = new Set(indexed.slice(0, numToRemove).map(x => x.index));

    // Generate post-period complaints (correlated with pre)
    const postComplaints = generateSyntheticOfficerData(
      params.numOfficers,
      params.numComplaints
    );

    // Add correlation between pre and post (persistence)
    const correlationFactor = params.probationMonths >= 60 ? 0.4 : 0.25;
    for (let i = 0; i < params.numOfficers; i++) {
      const preRank = indexed.findIndex(x => x.index === i) / params.numOfficers;
      const postBonus = (1 - preRank) * correlationFactor * (params.numComplaints / params.numOfficers);
      postComplaints[i] = Math.max(0, postComplaints[i] + Math.floor(postBonus));
    }

    // Count complaints from removed officers
    let complaintsFromRemoved = 0;
    for (const idx of removedIndices) {
      complaintsFromRemoved += postComplaints[idx];
    }

    // Estimate replacement officer complaints based on strategy
    let replacementFactor: number;
    switch (params.replacementStrategy) {
      case 'median':
        replacementFactor = 0.5;
        break;
      case 'p70_90':
        replacementFactor = 0.8;
        break;
      case 'same_district_median':
        replacementFactor = 0.55;
        break;
      case 'same_district_p70_90':
        replacementFactor = 0.85;
        break;
    }

    const avgComplaint = params.numComplaints / params.numOfficers;
    const replacementComplaints = numToRemove * avgComplaint * replacementFactor;

    // Net reduction
    const totalPost = postComplaints.reduce((a, b) => a + b, 0);
    const netReduction = (complaintsFromRemoved - replacementComplaints) / totalPost;

    results.push(netReduction * 100);
  }

  // Calculate mean and 95% CI
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  results.sort((a, b) => a - b);
  const ci: [number, number] = [
    results[Math.floor(results.length * 0.025)],
    results[Math.floor(results.length * 0.975)],
  ];

  return { mean, ci };
}

export default function BadApplesSimulator() {
  const [activeTab, setActiveTab] = useState('bias');
  const [isDark, setIsDark] = useState(false);

  // Simulation parameters
  const [numOfficers, setNumOfficers] = useState(1000);
  const [numComplaints, setNumComplaints] = useState(1500);
  const [topPercentile, setTopPercentile] = useState(10);
  const [replacementStrategy, setReplacementStrategy] = useState<SimulationParams['replacementStrategy']>('median');
  const [probationMonths, setProbationMonths] = useState(18);

  // Simulation results
  const [isSimulating, setIsSimulating] = useState(false);
  const [policyResult, setPolicyResult] = useState<{ mean: number; ci: [number, number] } | null>(null);

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

  // Generate concentration data
  const concentrationData = useMemo((): ConcentrationData => {
    const actualComplaints = generateSyntheticOfficerData(numOfficers, numComplaints);
    const actual = calculateConcentration(actualComplaints);
    const simulated = simulateRandomConcentration(numOfficers, numComplaints, 100);

    // Sample at regular intervals for plotting
    const step = Math.max(1, Math.floor(numOfficers / 100));
    const percentiles: number[] = [];
    const actualSampled: number[] = [];
    const simulatedSampled: number[] = [];
    const uniform: number[] = [];

    for (let i = 0; i < numOfficers; i += step) {
      const pct = ((i + 1) / numOfficers) * 100;
      percentiles.push(pct);
      actualSampled.push(actual[i] * 100);
      simulatedSampled.push(simulated[i] * 100);
      uniform.push(pct);
    }

    return {
      percentiles,
      actual: actualSampled,
      simulated: simulatedSampled,
      uniform,
    };
  }, [numOfficers, numComplaints]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    const idx2pct = Math.floor(numOfficers * 0.02) - 1;
    const idx10pct = Math.floor(numOfficers * 0.1) - 1;

    const actualShare2 = concentrationData.actual[Math.floor(concentrationData.percentiles.findIndex(p => p >= 2))] || 0;
    const simShare2 = concentrationData.simulated[Math.floor(concentrationData.percentiles.findIndex(p => p >= 2))] || 0;
    const actualShare10 = concentrationData.actual[Math.floor(concentrationData.percentiles.findIndex(p => p >= 10))] || 0;
    const simShare10 = concentrationData.simulated[Math.floor(concentrationData.percentiles.findIndex(p => p >= 10))] || 0;

    const naiveRR2 = calculateRelativeRisk(actualShare2 / 100, 2);
    const simRR2 = calculateRelativeRisk(simShare2 / 100, 2);
    const adjustedRR2 = simRR2 > 0 ? naiveRR2 / simRR2 : 0;

    const naiveRR10 = calculateRelativeRisk(actualShare10 / 100, 10);
    const simRR10 = calculateRelativeRisk(simShare10 / 100, 10);
    const adjustedRR10 = simRR10 > 0 ? naiveRR10 / simRR10 : 0;

    return {
      actualShare2,
      simShare2,
      naiveRR2,
      adjustedRR2,
      actualShare10,
      simShare10,
      naiveRR10,
      adjustedRR10,
      dataDensity: numComplaints / numOfficers,
    };
  }, [concentrationData, numOfficers, numComplaints]);

  // Persistence data
  const persistenceData = useMemo(() => {
    return generatePersistenceData(probationMonths);
  }, [probationMonths]);

  // Run policy simulation
  const runPolicySimulation = useCallback(() => {
    setIsSimulating(true);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const result = simulatePolicyImpact({
        numOfficers,
        numComplaints,
        topPercentile,
        replacementStrategy,
        probationMonths,
      });
      setPolicyResult(result);
      setIsSimulating(false);
    }, 50);
  }, [numOfficers, numComplaints, topPercentile, replacementStrategy, probationMonths]);

  const tabs = [
    { id: 'bias', label: 'Data Density Bias' },
    { id: 'persistence', label: 'Persistence Analysis' },
    { id: 'policy', label: 'Policy Simulation' },
    { id: 'calculator', label: 'What-If Calculator' },
  ];

  const baseLayout = isDark ? DARK_LAYOUT : LIGHT_LAYOUT;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary-900 dark:text-gray-100 mb-4">
          "Bad Apples" Policy Simulator
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl">
          Explore how data density bias affects our understanding of police complaint concentration,
          and simulate the impact of early warning system policies. Based on{' '}
          <a
            href="https://doi.org/10.1111/1745-9133.12542"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-burgundy dark:text-accent-gold hover:underline"
          >
            Chalfin & Kaplan (2021)
          </a>.
        </p>
      </div>

      {/* Global Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Number of Officers
          </label>
          <input
            type="number"
            value={numOfficers}
            onChange={(e) => setNumOfficers(Math.max(100, Math.min(15000, parseInt(e.target.value) || 1000)))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Number of Complaints
          </label>
          <input
            type="number"
            value={numComplaints}
            onChange={(e) => setNumComplaints(Math.max(10, Math.min(50000, parseInt(e.target.value) || 1500)))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Top Percentile to Remove
          </label>
          <select
            value={topPercentile}
            onChange={(e) => setTopPercentile(parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={2}>Top 2%</option>
            <option value={5}>Top 5%</option>
            <option value={10}>Top 10%</option>
            <option value={20}>Top 20%</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Data Density
          </label>
          <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            {metrics.dataDensity.toFixed(2)} complaints/officer
          </div>
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

      {/* Tab Content - Using CSS display to prevent unmount/remount issues with Plotly */}
      <div style={{ display: activeTab === 'bias' ? 'block' : 'none' }}>
        <div className="space-y-6">
          {/* Key Insight Box */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Key Insight: Data Density Bias</h4>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              When complaints are sparse relative to officers, even <strong>random</strong> assignment
              creates apparent concentration. The "top 2% account for X% of complaints" statistic
              is misleading without comparing to this null distribution.
            </p>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="value-box">
              <div className="value-box-title">Top 2% Share (Actual)</div>
              <div className="value-box-value">{metrics.actualShare2.toFixed(1)}%</div>
            </div>
            <div className="value-box">
              <div className="value-box-title">Top 2% Share (Random)</div>
              <div className="value-box-value">{metrics.simShare2.toFixed(1)}%</div>
            </div>
            <div className="value-box">
              <div className="value-box-title">Naive Relative Risk</div>
              <div className="value-box-value">{metrics.naiveRR2.toFixed(1)}x</div>
            </div>
            <div className="value-box">
              <div className="value-box-title">Adjusted Relative Risk</div>
              <div className="value-box-value text-accent-burgundy dark:text-accent-gold">{metrics.adjustedRR2.toFixed(1)}x</div>
            </div>
          </div>

          {/* Concentration Chart */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Complaint Concentration Curves</h3>
            <PlotWrapper
              data={[
                {
                  x: concentrationData.percentiles,
                  y: concentrationData.actual,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Actual Data',
                  line: { color: '#dc2626', width: 3 },
                },
                {
                  x: concentrationData.percentiles,
                  y: concentrationData.simulated,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Random Assignment',
                  line: { color: '#6b7280', width: 2, dash: 'dash' },
                },
                {
                  x: concentrationData.percentiles,
                  y: concentrationData.uniform,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Perfect Uniformity',
                  line: { color: '#000000', width: 1 },
                },
              ]}
              layout={{
                ...baseLayout,
                autosize: true,
                height: 400,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                showlegend: true,
                legend: { orientation: 'h' as const, y: -0.15 },
                xaxis: {
                  ...baseLayout.xaxis,
                  title: 'Cumulative % of Officers (ranked by complaints)',
                  range: [0, 100],
                },
                yaxis: {
                  ...baseLayout.yaxis,
                  title: 'Cumulative % of Complaints',
                  range: [0, 100],
                },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '400px' }}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              The gap between the red line (actual) and gray dashed line (random) represents
              <strong> true concentration</strong>. The gap between gray dashed and black (uniform)
              represents <strong>data density bias</strong> - concentration that appears even under
              pure randomness.
            </p>
          </div>

          {/* Explanation */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Understanding the Math</h3>
            <div className="prose dark:prose-invert max-w-none text-sm">
              <p>
                The naive calculation suggests the top 2% of officers are <strong>{metrics.naiveRR2.toFixed(1)}x</strong> more
                likely to generate complaints. However, even under random assignment, the top 2% would
                be <strong>{(metrics.simShare2 / 2 / ((100 - metrics.simShare2) / 98)).toFixed(1)}x</strong> more
                likely simply due to statistical clustering.
              </p>
              <p className="mt-2">
                After correcting for data density bias, the top 2% are actually only{' '}
                <strong className="text-accent-burgundy dark:text-accent-gold">{metrics.adjustedRR2.toFixed(1)}x</strong>{' '}
                more likely to generate complaints - still elevated, but far less dramatic than the naive estimate.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'persistence' ? 'block' : 'none' }}>
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Probation Period
              </label>
              <select
                value={probationMonths}
                onChange={(e) => setProbationMonths(parseInt(e.target.value))}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value={18}>18 months (standard)</option>
                <option value={60}>5 years (extended)</option>
              </select>
            </div>
          </div>

          {/* Key Insight */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Key Insight: Persistence is Imperfect</h4>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Officers in the top 2% during probation have only a ~2-4% chance of remaining
              in the top 2% over the next 10 years. Even with a 5-year observation window,
              positive predictive values remain modest, making surgical "bad apple" removal challenging.
            </p>
          </div>

          {/* Persistence Heatmap */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Persistence Matrix: Positive Predictive Values (%)</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Rows = percentile ranking during probation period | Columns = percentile ranking in 10-year follow-up
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Pre-Period</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Top 2%</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Top 5%</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Top 10%</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Top 20%</th>
                  </tr>
                </thead>
                <tbody>
                  {[2, 5, 10, 20].map((pre) => (
                    <tr key={pre} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">Top {pre}%</td>
                      {[2, 5, 10, 20].map((post) => {
                        const cell = persistenceData.find(
                          (c) => c.prePercentile === pre && c.postPercentile === post
                        );
                        const value = cell?.value || 0;
                        const intensity = Math.min(value / 50, 1);
                        return (
                          <td
                            key={post}
                            className="px-4 py-3 text-center text-sm font-medium"
                            style={{
                              backgroundColor: `rgba(220, 38, 38, ${intensity * 0.3})`,
                              color: isDark ? '#f3f4f6' : '#1f2937',
                            }}
                          >
                            {value.toFixed(1)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Example: Of officers in the top 10% during their probationary period, only ~{persistenceData.find(c => c.prePercentile === 10 && c.postPercentile === 10)?.value.toFixed(0)}%
              remain in the top 10% over the following 10 years. This limits the effectiveness of
              early identification strategies.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'policy' ? 'block' : 'none' }}>
        <div className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Replacement Strategy
              </label>
              <select
                value={replacementStrategy}
                onChange={(e) => setReplacementStrategy(e.target.value as SimulationParams['replacementStrategy'])}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="median">Median officer (40-60th percentile)</option>
                <option value="p70_90">70-90th percentile</option>
                <option value="same_district_median">Same district, median</option>
                <option value="same_district_p70_90">Same district, 70-90th percentile</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Probation Period
              </label>
              <select
                value={probationMonths}
                onChange={(e) => setProbationMonths(parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value={18}>18 months</option>
                <option value={60}>5 years</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={runPolicySimulation}
                disabled={isSimulating}
                className="w-full px-4 py-2 bg-primary-700 hover:bg-primary-800 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isSimulating ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>
          </div>

          {/* Key Insight */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Key Insight: Modest Incapacitation Effects</h4>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Chalfin & Kaplan find that removing the top 10% of officers (identified ex ante)
              and replacing them with median officers would reduce complaints by only <strong>4-6%</strong>.
              This modest effect stems from both prediction difficulty and the fact that replacement
              officers also generate complaints.
            </p>
          </div>

          {/* Results */}
          {policyResult && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Simulation Results</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="value-box">
                  <div className="value-box-title">Officers Removed</div>
                  <div className="value-box-value">{Math.floor(numOfficers * topPercentile / 100)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Top {topPercentile}% of {numOfficers}</div>
                </div>
                <div className="value-box">
                  <div className="value-box-title">Est. Complaint Reduction</div>
                  <div className="value-box-value text-green-600 dark:text-green-400">
                    {policyResult.mean.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    95% CI: [{policyResult.ci[0].toFixed(1)}%, {policyResult.ci[1].toFixed(1)}%]
                  </div>
                </div>
                <div className="value-box">
                  <div className="value-box-title">Complaints Averted</div>
                  <div className="value-box-value">
                    ~{Math.round(numComplaints * policyResult.mean / 100)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">per observation period</div>
                </div>
              </div>

              {/* Bar Chart */}
              <PlotWrapper
                data={[
                  {
                    x: ['Estimated Reduction'],
                    y: [policyResult.mean],
                    type: 'bar',
                    marker: { color: '#059669' },
                    error_y: {
                      type: 'data',
                      symmetric: false,
                      array: [policyResult.ci[1] - policyResult.mean],
                      arrayminus: [policyResult.mean - policyResult.ci[0]],
                    },
                  },
                ]}
                layout={{
                  ...baseLayout,
                  autosize: true,
                  height: 250,
                  margin: { l: 60, r: 20, t: 20, b: 40 },
                  showlegend: false,
                  yaxis: {
                    ...baseLayout.yaxis,
                    title: '% Reduction in Complaints',
                    range: [0, Math.max(20, policyResult.ci[1] + 5)],
                  },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%', height: '250px' }}
              />

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Even aggressive removal of the top {topPercentile}% of officers yields modest reductions.
                This suggests early warning systems may be more valuable for <strong>deterrence</strong> and
                <strong>accountability</strong> than for incapacitation alone.
              </p>
            </div>
          )}

          {!policyResult && (
            <div className="card p-6 text-center text-gray-500 dark:text-gray-400">
              <p>Click "Run Simulation" to see estimated policy impact.</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: activeTab === 'calculator' ? 'block' : 'none' }}>
        <div className="space-y-6">
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Build Your Own Scenario</h4>
            <p className="text-purple-700 dark:text-purple-300 text-sm">
              Adjust the parameters above to model your department's situation. The simulation
              will estimate how much removing "bad apples" might reduce complaints, accounting
              for prediction error and replacement effects.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Summary */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Your Parameters</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Department Size</span>
                  <span className="font-medium">{numOfficers.toLocaleString()} officers</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Annual Complaints (est.)</span>
                  <span className="font-medium">{numComplaints.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Data Density</span>
                  <span className="font-medium">{metrics.dataDensity.toFixed(2)} complaints/officer</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Removal Target</span>
                  <span className="font-medium">Top {topPercentile}% ({Math.floor(numOfficers * topPercentile / 100)} officers)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Replacement Strategy</span>
                  <span className="font-medium capitalize">{replacementStrategy.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">Observation Period</span>
                  <span className="font-medium">{probationMonths} months</span>
                </div>
              </div>

              <button
                onClick={runPolicySimulation}
                disabled={isSimulating}
                className="w-full mt-6 px-4 py-3 bg-primary-700 hover:bg-primary-800 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
              >
                {isSimulating ? 'Running Simulation...' : 'Calculate Impact'}
              </button>
            </div>

            {/* Results */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Projected Outcomes</h3>

              {policyResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm text-green-600 dark:text-green-400">Expected Complaint Reduction</div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                      {policyResult.mean.toFixed(1)}%
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      95% CI: {policyResult.ci[0].toFixed(1)}% to {policyResult.ci[1].toFixed(1)}%
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">In Absolute Numbers</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      ~{Math.round(numComplaints * policyResult.mean / 100)} fewer complaints
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      From {numComplaints.toLocaleString()} to ~{Math.round(numComplaints * (1 - policyResult.mean / 100)).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                    <strong>Note:</strong> These are estimates based on synthetic data calibrated
                    to empirical findings from Chicago PD. Actual results will vary based on
                    local factors, prediction accuracy, and implementation details.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p>Click "Calculate Impact" to see results</p>
                </div>
              )}
            </div>
          </div>

          {/* Comparison with Paper */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Comparison with Chalfin & Kaplan Findings</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Scenario</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Paper (Chicago)</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Your Simulation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3">Remove top 2%, median replacement</td>
                    <td className="px-4 py-3 text-center">-1.2%</td>
                    <td className="px-4 py-3 text-center">
                      {topPercentile === 2 && replacementStrategy === 'median' && policyResult
                        ? `${policyResult.mean.toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3">Remove top 10%, median replacement</td>
                    <td className="px-4 py-3 text-center">-6.1%</td>
                    <td className="px-4 py-3 text-center">
                      {topPercentile === 10 && replacementStrategy === 'median' && policyResult
                        ? `${policyResult.mean.toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Remove top 10%, same district 70-90th</td>
                    <td className="px-4 py-3 text-center">-5.2%</td>
                    <td className="px-4 py-3 text-center">
                      {topPercentile === 10 && replacementStrategy === 'same_district_p70_90' && policyResult
                        ? `${policyResult.mean.toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Citation */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Reference:</strong> Chalfin, A., & Kaplan, J. (2021). How many complaints against
          police officers can be abated by incapacitating a few "bad apples?" <em>Criminology & Public Policy</em>,
          20(2), 351-370.{' '}
          <a
            href="https://doi.org/10.1111/1745-9133.12542"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-burgundy dark:text-accent-gold hover:underline"
          >
            https://doi.org/10.1111/1745-9133.12542
          </a>
        </p>
      </div>
    </div>
  );
}
