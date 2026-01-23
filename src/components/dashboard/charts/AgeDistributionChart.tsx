import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function AgeDistributionChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const ages = data
      .map((r) => r.age_numeric)
      .filter((age): age is number => age !== null && !isNaN(age));

    return [{
      x: ages,
      type: 'histogram' as const,
      nbinsx: 30,
      marker: { color: COLORS.chart.steelBlue },
    }];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 50 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Age',
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: 'Count',
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
