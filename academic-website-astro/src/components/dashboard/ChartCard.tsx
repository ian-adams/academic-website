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
  const fullTitle = `${title} — ${causeLabel}, ${yearLabel}`;

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

    // Get current layout and data - make deep copies
    const currentData = JSON.parse(JSON.stringify((plotDiv as any).data));
    const currentLayout = JSON.parse(JSON.stringify((plotDiv as any).layout));

    // Create clean export layout (just the chart, we'll add title/attribution via canvas)
    const exportLayout = {
      ...currentLayout,
      margin: {
        l: currentLayout.margin?.l || 60,
        r: currentLayout.margin?.r || 60,
        t: 40,
        b: 60,
      },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      font: { ...currentLayout.font, color: '#374151' },
      xaxis: {
        ...currentLayout.xaxis,
        gridcolor: '#e5e7eb',
        linecolor: '#d1d5db',
        tickcolor: '#6b7280',
        tickfont: { color: '#374151' },
      },
      yaxis: {
        ...currentLayout.yaxis,
        gridcolor: '#e5e7eb',
        linecolor: '#d1d5db',
        tickcolor: '#6b7280',
        tickfont: { color: '#374151' },
      },
    };

    try {
      // Create temporary plot for export
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1200px';
      tempDiv.style.height = '700px';
      document.body.appendChild(tempDiv);

      await window.Plotly.newPlot(tempDiv, currentData, exportLayout, { staticPlot: true });

      const plotImageUrl = await window.Plotly.toImage(tempDiv, {
        format: 'png',
        width: 1200,
        height: 700,
        scale: 2,
      });

      // Clean up temp div
      window.Plotly.purge(tempDiv);
      document.body.removeChild(tempDiv);

      // Now create a canvas to combine plot + title + attribution
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        return;
      }

      // Canvas dimensions (2x for retina)
      const scale = 2;
      const width = 1200;
      const height = 850; // Extra space for title and attribution
      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.scale(scale, scale);

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Draw title at top
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fullTitle, width / 2, 35);

      // Load and draw the plot image
      const plotImage = new Image();
      plotImage.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        plotImage.onload = () => {
          // Draw plot image below title
          ctx.drawImage(plotImage, 0, 55, width, 700);
          resolve();
        };
        plotImage.onerror = reject;
        plotImage.src = plotImageUrl;
      });

      // Draw attribution at bottom
      const attributionText = `Source: Mapping Police Violence  •  ${ATTRIBUTION.name}, ${ATTRIBUTION.institution}  •  ${ATTRIBUTION.website}  •  ${today}`;
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(attributionText, width / 2, height - 15);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${causeLabel.toLowerCase().replace(/\s+/g, '-')}-${yearLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png');

    } catch (err) {
      console.error('Failed to export chart:', err);
    }
  }, [fullTitle, title, causeLabel, yearLabel]);

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {causeLabel} • {yearLabel}
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
      {/* Attribution footer */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Source: Mapping Police Violence • {ATTRIBUTION.name}, {ATTRIBUTION.institution} • {ATTRIBUTION.website} • {today}
        </p>
      </div>
    </div>
  );
}

// Add Plotly type to window
declare global {
  interface Window {
    Plotly: any;
  }
}
