import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function DayOfWeekChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d] = 0));

    data.forEach((r) => {
      const [y, m, d] = r.date.split('-').map(Number);
      const day = days[new Date(y, m - 1, d).getDay()];
      counts[day]++;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const percentages = days.map((d) => (counts[d] / total) * 100);

    return [
      {
        x: days,
        y: percentages,
        type: 'bar' as const,
        marker: { color: COLORS.chart.steelBlue },
      },
      {
        x: days,
        y: Array(7).fill(100 / 7),
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: 'red', dash: 'dash' as const },
        name: 'Expected (uniform)',
      },
    ];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 50 },
    showlegend: false,
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: '% of Incidents',
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
