import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function RaceDistributionChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((r) => {
      counts[r.race_clean] = (counts[r.race_clean] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const races = sorted.map(([race]) => race);
    const values = sorted.map(([, count]) => count);
    const colors = races.map((race) => COLORS.races[race as keyof typeof COLORS.races] || COLORS.races.Unknown);

    return [{
      y: races,
      x: values,
      type: 'bar' as const,
      orientation: 'h' as const,
      marker: { color: colors },
    }];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 120, r: 20, t: 20, b: 50 },
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
