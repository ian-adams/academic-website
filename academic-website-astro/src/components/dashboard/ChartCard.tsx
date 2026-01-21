import { useRef, useCallback, type ReactNode } from 'react';
import { ATTRIBUTION } from './types';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  causeLabel: string;
  yearLabel: string;
  isDark: boolean;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  causeLabel,
  yearLabel,
  isDark,
}: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Build full title with filter context
  const fullTitle = `${title} — ${causeLabel}${yearLabel !== 'All Years' ? `, ${yearLabel}` : ''}`;

  const handleDownload = useCallback(async () => {
    // Find the Plotly chart inside this card
    const plotDiv = chartRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;

    if (!plotDiv || !window.Plotly) {
      console.error('Plotly chart not found');
      return;
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Get current layout and data
    const currentData = (plotDiv as any).data;
    const currentLayout = (plotDiv as any).layout;

    // Create modified layout with title and attribution
    const exportLayout = {
      ...currentLayout,
      title: {
        text: `<b>${fullTitle}</b>`,
        font: { size: 16 },
        x: 0.5,
        xanchor: 'center',
      },
      margin: {
        ...currentLayout.margin,
        t: 80,
        b: (currentLayout.margin?.b || 50) + 40,
      },
      annotations: [
        ...(currentLayout.annotations || []),
        {
          text: `Source: Mapping Police Violence | ${ATTRIBUTION.name}, ${ATTRIBUTION.institution} | ${ATTRIBUTION.website} | ${today}`,
          showarrow: false,
          xref: 'paper',
          yref: 'paper',
          x: 0.5,
          y: -0.18,
          xanchor: 'center',
          font: { size: 10, color: '#6b7280' },
        },
      ],
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      font: { color: '#374151' },
    };

    try {
      const dataUrl = await window.Plotly.toImage(plotDiv, {
        format: 'png',
        width: 1200,
        height: 800,
        scale: 2,
      });

      // Create temporary plot for export with modified layout
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      await window.Plotly.newPlot(tempDiv, currentData, exportLayout, { staticPlot: true });

      const exportDataUrl = await window.Plotly.toImage(tempDiv, {
        format: 'png',
        width: 1200,
        height: 800,
        scale: 2,
      });

      // Clean up temp div
      window.Plotly.purge(tempDiv);
      document.body.removeChild(tempDiv);

      // Download the image
      const link = document.createElement('a');
      const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${causeLabel.toLowerCase().replace(/\s+/g, '-')}-${yearLabel.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.download = filename;
      link.href = exportDataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export chart:', err);
    }
  }, [fullTitle, title, causeLabel, yearLabel]);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {causeLabel}{yearLabel !== 'All Years' ? ` • ${yearLabel}` : ''}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Download chart as PNG"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </button>
      </div>
      <div ref={chartRef}>{children}</div>
    </div>
  );
}

// Add Plotly type to window
declare global {
  interface Window {
    Plotly: any;
  }
}
