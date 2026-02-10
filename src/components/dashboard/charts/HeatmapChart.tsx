import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT } from '../types';

export default function HeatmapChart({ data, isDark }: ChartProps) {
  const plotData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    // Create matrix
    const z: (number | null)[][] = months.map(() => Array(31).fill(0));

    data.forEach((r) => {
      const date = new Date(r.date);
      const month = date.getMonth();
      const day = date.getDate() - 1;
      if (day >= 0 && day < 31) {
        (z[month][day] as number)++;
      }
    });

    // Set impossible dates to null
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 0; m < 12; m++) {
      for (let d = daysInMonth[m]; d < 31; d++) {
        z[m][d] = null;
      }
    }

    return [{
      z,
      x: days,
      y: months,
      type: 'heatmap' as const,
      colorscale: [
        [0, 'lightyellow'],
        [1, 'darkred'],
      ],
      showscale: true,
    }];
  }, [data]);

  const layout = useMemo(() => ({
    ...(isDark ? DARK_LAYOUT : LIGHT_LAYOUT),
    autosize: true,
    height: 350,
    margin: { l: 50, r: 80, t: 20, b: 50 },
    xaxis: {
      ...(isDark ? DARK_LAYOUT.xaxis : LIGHT_LAYOUT.xaxis),
      title: 'Day of Month',
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
