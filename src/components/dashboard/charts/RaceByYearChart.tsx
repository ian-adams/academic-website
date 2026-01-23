import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function RaceByYearChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    // Group by year and race
    const byYearRace: Record<number, Record<string, number>> = {};
    data.forEach((r) => {
      if (!byYearRace[r.year]) byYearRace[r.year] = {};
      byYearRace[r.year][r.race_clean] = (byYearRace[r.year][r.race_clean] || 0) + 1;
    });

    const years = Object.keys(byYearRace).map(Number).sort();
    const races = ['White', 'Black', 'Hispanic', 'Asian', 'Native American', 'Other', 'Unknown'];

    return races.map((race) => ({
      x: years,
      y: years.map((year) => byYearRace[year][race] || 0),
      type: 'bar' as const,
      name: race,
      marker: { color: COLORS.races[race as keyof typeof COLORS.races] || COLORS.races.Unknown },
    }));
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 50 },
    barmode: 'stack' as const,
    showlegend: true,
    legend: { orientation: 'h' as const, y: -0.2 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Year',
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
