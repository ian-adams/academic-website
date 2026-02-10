import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function BodyCameraChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const byYear: Record<number, { total: number; camera: number }> = {};

    data.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { total: 0, camera: 0 };
      byYear[r.year].total++;
      if (r.body_camera) byYear[r.year].camera++;
    });

    const years = Object.keys(byYear).map(Number).sort();
    const percentages = years.map((year) => byYear[year].total > 0 ? (byYear[year].camera / byYear[year].total) * 100 : 0);

    return [
      {
        x: years,
        y: percentages,
        type: 'scatter' as const,
        mode: 'none' as const,
        fill: 'tozeroy' as const,
        fillcolor: isDark ? 'rgba(74, 222, 128, 0.3)' : 'rgba(0, 100, 0, 0.3)',
        name: 'Area',
      },
      {
        x: years,
        y: percentages,
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: isDark ? '#4ade80' : COLORS.chart.darkGreen, width: 2 },
        name: '% with Body Camera',
      },
    ];
  }, [data, isDark]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 50 },
    showlegend: false,
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Year',
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: '% with Body Camera',
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
