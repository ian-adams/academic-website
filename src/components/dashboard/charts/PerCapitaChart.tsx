import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function PerCapitaChart({ data, population, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    // Count by year
    const yearCounts: Record<number, number> = {};
    data.forEach((r) => {
      yearCounts[r.year] = (yearCounts[r.year] || 0) + 1;
    });

    // Calculate rates
    const years = Object.keys(yearCounts).map(Number).sort();
    const rates = years.map((year) => {
      const pop = population[year];
      if (!pop) return 0;
      return (yearCounts[year] / pop) * 1000000;
    });

    // Standard errors (simplified)
    const errors = rates.map((rate, i) => {
      const n = yearCounts[years[i]];
      return rate / Math.sqrt(0.92 * n);
    });

    return [{
      x: years,
      y: rates,
      type: 'bar' as const,
      marker: { color: COLORS.chart.blue },
      error_y: {
        type: 'data' as const,
        array: errors.map((e) => 1.96 * e),
        visible: true,
        color: isDark ? '#9ca3af' : '#374151',
      },
    }];
  }, [data, population, isDark]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 60, r: 20, t: 20, b: 50 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Year',
      tickmode: 'linear' as const,
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: 'Rate per 1M People',
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
