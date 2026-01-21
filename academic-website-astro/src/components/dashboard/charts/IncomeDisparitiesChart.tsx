import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function IncomeDisparitiesChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const races = ['White', 'Black', 'Hispanic'];
    const brackets = [
      { label: '$0-35K', min: 0, max: 35000 },
      { label: '$35-50K', min: 35000, max: 50000 },
      { label: '$50-75K', min: 50000, max: 75000 },
      { label: '$75-100K', min: 75000, max: 100000 },
      { label: '$100K+', min: 100000, max: 250001 },
    ];

    const filtered = data.filter(
      (r) => races.includes(r.race_clean) && r.median_household_income !== null
    );

    return races.map((race) => {
      const raceData = filtered.filter((r) => r.race_clean === race);
      const counts = brackets.map((bracket) =>
        raceData.filter(
          (r) => r.median_household_income! >= bracket.min && r.median_household_income! < bracket.max
        ).length
      );

      return {
        x: brackets.map((b) => b.label),
        y: counts,
        type: 'bar' as const,
        name: race,
        marker: { color: COLORS.races[race as keyof typeof COLORS.races] },
      };
    });
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 70 },
    barmode: 'group' as const,
    showlegend: true,
    legend: { orientation: 'h' as const, y: -0.25 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Neighborhood Income',
      tickangle: -45,
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: 'Deaths',
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
