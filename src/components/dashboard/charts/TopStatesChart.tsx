import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function TopStatesChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((r) => {
      if (r.state) counts[r.state] = (counts[r.state] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    return [{
      y: sorted.map(([state]) => state),
      x: sorted.map(([, count]) => count),
      type: 'bar' as const,
      orientation: 'h' as const,
      marker: { color: COLORS.chart.steelBlue },
    }];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 400,
    margin: { l: 60, r: 20, t: 20, b: 50 },
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
      style={{ width: '100%', height: '400px' }}
    />
  );
}
