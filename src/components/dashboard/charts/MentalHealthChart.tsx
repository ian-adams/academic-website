import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function MentalHealthChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const byYear: Record<number, { total: number; mental: number }> = {};

    data.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { total: 0, mental: 0 };
      byYear[r.year].total++;
      if (r.mental_illness_symptoms) byYear[r.year].mental++;
    });

    const years = Object.keys(byYear).map(Number).sort();
    const percentages = years.map((year) => byYear[year].total > 0 ? (byYear[year].mental / byYear[year].total) * 100 : 0);

    // Calculate trend line
    const n = years.length;
    const sumX = years.reduce((a, b) => a + b, 0);
    const sumY = percentages.reduce((a, b) => a + b, 0);
    const sumXY = years.reduce((sum, x, i) => sum + x * percentages[i], 0);
    const sumX2 = years.reduce((sum, x) => sum + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const trendY = years.map((x) => slope * x + intercept);
    const clampedTrendY = trendY.map(v => Math.max(0, Math.min(100, v)));

    return [
      {
        x: years,
        y: percentages,
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        line: { color: COLORS.chart.darkBlue, width: 2 },
        marker: { size: 8 },
        name: 'Observed',
      },
      {
        x: years,
        y: clampedTrendY,
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: 'red', dash: 'dash' as const },
        name: 'Trend',
      },
    ];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 50 },
    showlegend: true,
    legend: { orientation: 'h' as const, y: -0.15 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Year',
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: '% with Mental Health Symptoms',
    },
  }), [isDark]);

  return (
    <Plot
      data={plotData}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '350px' }}
    />
  );
}
