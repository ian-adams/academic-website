import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function ArmedStatusChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((r) => {
      const status = r.armed_unarmed_status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    return [{
      y: sorted.map(([status]) => status),
      x: sorted.map(([, count]) => count),
      type: 'bar' as const,
      orientation: 'h' as const,
      marker: { color: isDark ? '#818cf8' : COLORS.chart.navy },
    }];
  }, [data, isDark]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 150, r: 20, t: 20, b: 50 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Count',
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
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
