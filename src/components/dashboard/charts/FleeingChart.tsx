import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT, COLORS } from '../types';

export default function FleeingChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const races = ['White', 'Black', 'Hispanic'];
    const statuses = ['Not Fleeing', 'Fleeing'];

    const filtered = data.filter(
      (r) => races.includes(r.race_clean) && r.fleeing_clean !== 'Unknown'
    );

    return statuses.map((status) => {
      const statusData = races.map((race) => {
        const raceRecords = filtered.filter((r) => r.race_clean === race);
        const statusCount = raceRecords.filter((r) => r.fleeing_clean === status).length;
        return raceRecords.length > 0 ? (statusCount / raceRecords.length) * 100 : 0;
      });

      return {
        x: races,
        y: statusData,
        type: 'bar' as const,
        name: status,
        marker: { color: status === 'Fleeing' ? '#f43f5e' : '#10b981' },
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
    },
    yaxis: {
      ...(isDark ? DARK_LAYOUT.yaxis : LIGHT_LAYOUT.yaxis),
      title: '% of Victims',
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
