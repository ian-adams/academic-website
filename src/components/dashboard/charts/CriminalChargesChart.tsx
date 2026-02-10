import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function CriminalChargesChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const byYear: Record<number, { total: number; charged: number }> = {};

    data.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { total: 0, charged: 0 };
      byYear[r.year].total++;

      const charges = (r.criminal_charges || '').toLowerCase();
      if (charges && charges.includes('charged') && !charges.includes('no ') && !charges.includes('not ')) {
        byYear[r.year].charged++;
      }
    });

    const years = Object.keys(byYear).map(Number).sort();
    const percentages = years.map((year) => (byYear[year].charged / byYear[year].total) * 100);
    const avgPct = percentages.reduce((a, b) => a + b, 0) / percentages.length;

    return [
      {
        x: years,
        y: percentages,
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        line: { color: COLORS.chart.darkBlue, width: 2 },
        name: '% Charged',
      },
      {
        x: years,
        y: Array(years.length).fill(avgPct),
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: 'red', dash: 'dash' as const },
        name: 'Average',
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
      title: '% with Criminal Charges',
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
