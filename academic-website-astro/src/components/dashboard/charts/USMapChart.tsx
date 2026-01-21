import { useMemo, useEffect, useState } from 'react';
import type { ChartProps } from '../types';

// We'll use Leaflet for the map since it's free and doesn't require an API key
export default function USMapChart({ data, isDark }: ChartProps) {
  const [mapLoaded, setMapLoaded] = useState(false);

  const points = useMemo(() => {
    return data
      .filter((r) => r.latitude !== null && r.longitude !== null)
      .map((r) => ({
        lat: r.latitude!,
        lng: r.longitude!,
        race: r.race_clean,
      }));
  }, [data]);

  useEffect(() => {
    // Dynamically import Leaflet to avoid SSR issues
    const loadMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      // Check if map already exists
      const container = document.getElementById('us-map');
      if (!container) return;
      if ((container as any)._leaflet_id) {
        // Map already initialized, just update markers
        return;
      }

      const map = L.map('us-map').setView([39.8283, -98.5795], 4);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Add markers (using circle markers for better performance with many points)
      const markerGroup = L.layerGroup().addTo(map);

      points.forEach((point) => {
        L.circleMarker([point.lat, point.lng], {
          radius: 3,
          fillColor: '#8b0000',
          color: '#8b0000',
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.5,
        }).addTo(markerGroup);
      });

      // Fit bounds to US
      map.fitBounds([
        [24, -125],
        [49, -66],
      ]);

      setMapLoaded(true);
    };

    loadMap();
  }, [points]);

  return (
    <div className="relative">
      <div
        id="us-map"
        className="w-full h-[500px] rounded-lg"
        style={{ background: isDark ? '#1f2937' : '#f3f4f6' }}
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 dark:border-primary-400"></div>
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {points.length.toLocaleString()} incidents with valid coordinates
      </p>
    </div>
  );
}
