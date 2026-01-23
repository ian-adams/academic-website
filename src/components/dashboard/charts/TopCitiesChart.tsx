import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT } from '../types';

export default function TopCitiesChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const cityCounts: Record<string, { n: number; unarmed: number }> = {};

    data.forEach((r) => {
      if (r.city && r.state) {
        const key = `${r.city}, ${r.state}`;
        if (!cityCounts[key]) cityCounts[key] = { n: 0, unarmed: 0 };
        cityCounts[key].n++;
        if (r.armed_unarmed_status?.toLowerCase().includes('unarmed')) {
          cityCounts[key].unarmed++;
        }
      }
    });

    const sorted = Object.entries(cityCounts)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 20);

    const cities = sorted.map(([city]) => city);
    const counts = sorted.map(([, data]) => data.n);
    const unarmedPct = sorted.map(([, data]) => (data.unarmed / data.n) * 100);

    return [{
      y: cities,
      x: counts,
      type: 'bar' as const,
      orientation: 'h' as const,
      marker: {
        color: unarmedPct,
        colorscale: [
          [0, 'lightblue'],
          [1, 'darkred'],
        ],
        showscale: true,
        colorbar: { title: '% Unarmed' },
      },
    }];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 500,
    margin: { l: 150, r: 80, t: 20, b: 50 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Deaths',
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      autorange: 'reversed' as const,
    },
  }), [isDark]);

  return (
    <Plot
      data={plotData}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '500px' }}
    />
  );
}
