import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT } from '../types';

export default function CumulativeChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    // Group by year
    const byYear: Record<number, { date: string; count: number }[]> = {};
    data.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = [];
      byYear[r.year].push({ date: r.date, count: 1 });
    });

    // Calculate cumulative counts per year
    const years = Object.keys(byYear).map(Number).sort();
    const latestYear = Math.max(...years);

    const traces = years.map((year) => {
      const sorted = byYear[year].sort((a, b) => a.date.localeCompare(b.date));

      // Group by date and calculate cumulative
      const dateMap: Record<string, number> = {};
      sorted.forEach((d) => {
        const mmdd = d.date.slice(5); // MM-DD
        dateMap[mmdd] = (dateMap[mmdd] || 0) + 1;
      });

      const dates = Object.keys(dateMap).sort();
      let cumulative = 0;
      const x: string[] = [];
      const y: number[] = [];

      dates.forEach((date) => {
        cumulative += dateMap[date];
        x.push(date);
        y.push(cumulative);
      });

      const isLatest = year === latestYear;
      return {
        x,
        y,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: year.toString(),
        line: {
          color: isLatest ? '#f43f5e' : '#9ca3af',
          width: isLatest ? 3 : 1,
        },
        opacity: isLatest ? 1 : 0.4,
      };
    });

    return traces;
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 50 },
    showlegend: true,
    legend: { orientation: 'h' as const, y: -0.2 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Month-Day',
      tickangle: -45,
      type: 'category' as const,
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: 'Cumulative Deaths',
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
