import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function AgeRaceChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const races = ['White', 'Black', 'Hispanic'];
    const ageGroups = ['0-18', '19-25', '26-35', '36-45', '46-55', '56-65', '65+'];

    const getAgeGroup = (age: number): string => {
      if (age <= 18) return '0-18';
      if (age <= 25) return '19-25';
      if (age <= 35) return '26-35';
      if (age <= 45) return '36-45';
      if (age <= 55) return '46-55';
      if (age <= 65) return '56-65';
      return '65+';
    };

    const filtered = data.filter(
      (r) => races.includes(r.race_clean) && r.age_numeric !== null && !isNaN(r.age_numeric!)
    );

    return races.map((race) => {
      const raceData = filtered.filter((r) => r.race_clean === race);
      const counts = ageGroups.map(
        (group) => raceData.filter((r) => getAgeGroup(r.age_numeric!) === group).length
      );

      return {
        x: ageGroups,
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
    margin: { l: 50, r: 20, t: 20, b: 50 },
    barmode: 'group' as const,
    showlegend: true,
    legend: { orientation: 'h' as const, y: -0.15 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Age Group',
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
