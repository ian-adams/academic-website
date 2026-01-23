import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function UnarmedByRaceChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const races = ['White', 'Black', 'Hispanic', 'Asian'];
    const raceData = data.filter((r) => races.includes(r.race_clean));

    const stats = races.map((race) => {
      const raceRecords = raceData.filter((r) => r.race_clean === race);
      const unarmedCount = raceRecords.filter((r) =>
        r.armed_unarmed_status?.toLowerCase().includes('unarmed')
      ).length;
      return {
        race,
        pct: raceRecords.length > 0 ? (unarmedCount / raceRecords.length) * 100 : 0,
      };
    });

    stats.sort((a, b) => b.pct - a.pct);

    return [{
      x: stats.map((s) => s.race),
      y: stats.map((s) => s.pct),
      type: 'bar' as const,
      marker: {
        color: stats.map((s) => COLORS.races[s.race as keyof typeof COLORS.races]),
      },
    }];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 20, t: 20, b: 50 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: '% Unarmed',
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
