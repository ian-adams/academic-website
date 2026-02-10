import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ChartProps } from '../types';
import { DARK_LAYOUT, LIGHT_LAYOUT } from '../types';

// Convert date to day of year (1-366)
function getDayOfYear(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

// Month start days for tick marks
const MONTH_TICKS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CumulativeChart({ data, isDark }: ChartProps) {
  const { traces, annotations, maxY } = useMemo(() => {
    // Group records by year
    const byYear: Record<number, string[]> = {};
    data.forEach((r) => {
      if (!r.date) return;
      const year = r.year;
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(r.date);
    });

    const years = Object.keys(byYear).map(Number).sort();
    if (years.length === 0) {
      return { traces: [], annotations: [], maxY: 100 };
    }

    const latestYear = Math.max(...years);
    let globalMaxY = 0;

    // Color palette for years (older to newer)
    const getYearColor = (year: number, isLatest: boolean) => {
      if (isLatest) return '#dc2626'; // Red for latest year
      // Gray scale for older years
      return '#9ca3af';
    };

    const traces = years.map((year) => {
      const dates = byYear[year].sort();

      // Group by day of year and calculate cumulative
      const dayCountMap: Record<number, number> = {};
      dates.forEach((d) => {
        const doy = getDayOfYear(d);
        dayCountMap[doy] = (dayCountMap[doy] || 0) + 1;
      });

      // Build cumulative series
      const sortedDays = Object.keys(dayCountMap).map(Number).sort((a, b) => a - b);
      let cumulative = 0;
      const x: number[] = [];
      const y: number[] = [];

      sortedDays.forEach((day) => {
        cumulative += dayCountMap[day];
        x.push(day);
        y.push(cumulative);
      });

      if (cumulative > globalMaxY) globalMaxY = cumulative;

      const isLatest = year === latestYear;
      return {
        x,
        y,
        year,
        finalCount: cumulative,
        finalDay: x[x.length - 1] || 0,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: year.toString(),
        line: {
          color: getYearColor(year, isLatest),
          width: isLatest ? 3 : 1.5,
        },
        opacity: isLatest ? 1 : 0.35,
        hovertemplate: `${year}<br>Day %{x}<br>Cumulative: %{y}<extra></extra>`,
        showlegend: false,
      };
    });

    // Create annotations for end-of-line labels
    const annotations = traces.map((trace) => ({
      x: trace.finalDay,
      y: trace.finalCount,
      text: `${trace.year} (${trace.finalCount.toLocaleString()})`,
      showarrow: false,
      xanchor: 'left' as const,
      yanchor: 'middle' as const,
      xshift: 5,
      font: {
        size: 10,
        color: trace.year === latestYear
          ? (isDark ? '#fca5a5' : '#dc2626')
          : (isDark ? '#9ca3af' : '#6b7280'),
        weight: trace.year === latestYear ? 700 : 400,
      },
    }));

    return { traces, annotations, maxY: globalMaxY };
  }, [data, isDark]);

  const layout = useMemo(() => {
    const baseLayout = isDark ? DARK_LAYOUT : LIGHT_LAYOUT;

    return {
      ...baseLayout,
      autosize: true,
      height: 400,
      margin: { l: 60, r: 100, t: 30, b: 50 },
      showlegend: false,
      xaxis: {
        ...baseLayout.xaxis,
        title: 'Month',
        tickmode: 'array' as const,
        tickvals: MONTH_TICKS,
        ticktext: MONTH_LABELS,
        range: [0, 370],
        gridcolor: isDark ? '#374151' : '#e5e7eb',
      },
      yaxis: {
        ...baseLayout.yaxis,
        title: 'Cumulative Deaths',
        range: [0, maxY * 1.05],
        gridcolor: isDark ? '#374151' : '#e5e7eb',
      },
      annotations,
    };
  }, [isDark, annotations, maxY]);

  if (traces.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '400px' }}
    />
  );
}
