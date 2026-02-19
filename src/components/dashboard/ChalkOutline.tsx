import React from 'react';

interface ChalkOutlineProps {
  wounds: string[];
  revealed?: boolean;
  fatal?: boolean;
}

// SVG coordinates for wound marker placement on front-facing human silhouette
// Each region maps to [cx, cy] center point for the bullet hole marker
const WOUND_POSITIONS: Record<string, [number, number][]> = {
  head: [[100, 28]],
  neck: [[100, 52]],
  chest: [[100, 82], [85, 78], [115, 78]],
  abdomen: [[100, 118], [90, 122], [110, 122]],
  arms: [[50, 105], [150, 105], [44, 122], [156, 122]],
  legs: [[83, 180], [119, 180], [80, 205], [121, 205]],
};

// Distribute wounds across available positions for a region
function getWoundPositions(region: string): [number, number] {
  const positions = WOUND_POSITIONS[region];
  if (!positions) return [100, 100];
  // Return first position (others used if same region appears multiple times)
  return positions[0];
}

export default function ChalkOutline({ wounds, revealed, fatal }: ChalkOutlineProps) {
  // Deduplicate wound regions and pick positions
  const uniqueWounds = [...new Set(wounds)];
  const markers = uniqueWounds.map((region) => ({
    region,
    pos: getWoundPositions(region),
  }));

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg
        viewBox="0 0 200 260"
        className="w-full h-auto"
        role="img"
        aria-label={`Human silhouette with ${uniqueWounds.length} wound ${uniqueWounds.length === 1 ? 'region' : 'regions'} marked: ${uniqueWounds.join(', ')}`}
      >
        {/* Dark ground/asphalt background */}
        <rect width="200" height="260" fill="#1a1a1a" rx="8" />

        {/* Chalk outline - human figure (front view) */}
        <g
          className="transition-opacity duration-500"
          style={{
            filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.3))',
            opacity: revealed ? (fatal ? 0.5 : 1) : 0.85,
          }}
        >
          {/* Head */}
          <ellipse cx="100" cy="28" rx="16" ry="19"
            fill="none" stroke="#d4d0c8" strokeWidth="1.8"
            strokeDasharray="3 1" opacity="0.9" />

          {/* Neck */}
          <line x1="95" y1="47" x2="95" y2="56"
            stroke="#d4d0c8" strokeWidth="1.5" strokeDasharray="2 1" opacity="0.8" />
          <line x1="105" y1="47" x2="105" y2="56"
            stroke="#d4d0c8" strokeWidth="1.5" strokeDasharray="2 1" opacity="0.8" />

          {/* Torso */}
          <path
            d="M 75 56 Q 72 58 70 65 L 68 105 Q 68 135 75 140 L 80 142 Q 95 145 100 145 Q 105 145 120 142 L 125 140 Q 132 135 132 105 L 130 65 Q 128 58 125 56 Z"
            fill="none" stroke="#d4d0c8" strokeWidth="1.8"
            strokeDasharray="4 1.5" opacity="0.9"
          />

          {/* Mid-torso line (chest/abdomen divider) */}
          <line x1="72" y1="105" x2="128" y2="105"
            stroke="#d4d0c8" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.3" />

          {/* Left arm - closed shape with width */}
          <path
            d="M 70 62 Q 55 65 48 80 L 38 110 Q 35 120 32 130 Q 30 135 33 137 L 37 138 Q 40 136 42 130 L 52 100 Q 58 82 62 72 Q 66 64 75 60 Z"
            fill="#1a1a1a" stroke="#d4d0c8" strokeWidth="1.6"
            strokeDasharray="3 1.5" opacity="0.85"
          />

          {/* Right arm - closed shape with width */}
          <path
            d="M 130 62 Q 145 65 152 80 L 162 110 Q 165 120 168 130 Q 170 135 167 137 L 163 138 Q 160 136 158 130 L 148 100 Q 142 82 138 72 Q 134 64 125 60 Z"
            fill="#1a1a1a" stroke="#d4d0c8" strokeWidth="1.6"
            strokeDasharray="3 1.5" opacity="0.85"
          />

          {/* Left leg - closed shape with width */}
          <path
            d="M 85 142 L 82 165 Q 80 180 78 200 L 76 225 Q 75 232 70 235 L 65 236 L 65 240 L 73 239 Q 79 236 80 230 L 83 205 Q 85 185 88 165 L 92 142 Z"
            fill="#1a1a1a" stroke="#d4d0c8" strokeWidth="1.7"
            strokeDasharray="3 1.5" opacity="0.85"
          />

          {/* Right leg - closed shape with width */}
          <path
            d="M 115 142 L 118 165 Q 120 180 122 200 L 124 225 Q 125 232 130 235 L 135 236 L 135 240 L 127 239 Q 121 236 120 230 L 117 205 Q 115 185 112 165 L 108 142 Z"
            fill="#1a1a1a" stroke="#d4d0c8" strokeWidth="1.7"
            strokeDasharray="3 1.5" opacity="0.85"
          />
        </g>

        {/* Wound markers - red bullet holes */}
        {markers.map(({ region, pos }, i) => (
          <g key={`${region}-${i}`}>
            {/* Outer glow */}
            <circle
              cx={pos[0]} cy={pos[1]} r="9"
              fill="none"
              stroke="#dc2626"
              strokeWidth="0.5"
              opacity="0.3"
            />
            {/* Impact ring */}
            <circle
              cx={pos[0]} cy={pos[1]} r="6"
              fill="#7f1d1d"
              stroke="#dc2626"
              strokeWidth="1.2"
              opacity="0.85"
            />
            {/* Center hole */}
            <circle
              cx={pos[0]} cy={pos[1]} r="2.5"
              fill="#1a0000"
              opacity="0.95"
            />
            {/* Highlight */}
            <circle
              cx={pos[0] - 1} cy={pos[1] - 1} r="1"
              fill="#ef4444"
              opacity="0.6"
            />
          </g>
        ))}

        {/* Revealed state overlay */}
        {revealed && (
          <g>
            {fatal ? (
              <>
                {/* X eyes for fatal */}
                <line x1="92" y1="22" x2="96" y2="26" stroke="#ef4444" strokeWidth="1.5" opacity="0.8" />
                <line x1="96" y1="22" x2="92" y2="26" stroke="#ef4444" strokeWidth="1.5" opacity="0.8" />
                <line x1="104" y1="22" x2="108" y2="26" stroke="#ef4444" strokeWidth="1.5" opacity="0.8" />
                <line x1="108" y1="22" x2="104" y2="26" stroke="#ef4444" strokeWidth="1.5" opacity="0.8" />
              </>
            ) : (
              <>
                {/* Open eyes for survived */}
                <circle cx="94" cy="24" r="2" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.8" />
                <circle cx="106" cy="24" r="2" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.8" />
              </>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
