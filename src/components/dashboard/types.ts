// MPV Data types

export interface MPVRecord {
  date: string;
  year: number;
  month: string;
  day: string;
  day_of_year: number;
  age_numeric: number | null;
  race_clean: string;
  fleeing_clean: string;
  mental_illness_symptoms: boolean;
  state: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  cause_of_death: string;
  armed_unarmed_status: string;
  alleged_weapon: string;
  body_camera: boolean;
  criminal_charges: string;
  median_household_income: number | null;
}

export interface MPVData {
  updated: string;
  count: number;
  records: MPVRecord[];
  population: Record<number, number>;
}

export interface FilterState {
  causeFilter: 'all' | 'shootings';
  yearFilter: string;
}

export interface FilterContext {
  causeFilter: 'all' | 'shootings';
  yearFilter: string;
  causeLabel: string; // "All Deaths" or "Fatal Shootings"
  yearLabel: string;  // "All Years" or specific year
}

export interface ChartProps {
  data: MPVRecord[];
  population: Record<number, number>;
  isDark: boolean;
  filterContext?: FilterContext;
}

// Attribution for downloads
export const ATTRIBUTION = {
  name: 'Ian T. Adams, Ph.D.',
  institution: 'University of South Carolina',
  website: 'ianadamsresearch.com',
};

// Color palettes
export const COLORS = {
  primary: '#334e68',
  accent: '#c9a227',
  races: {
    White: '#6366f1',
    Black: '#f43f5e',
    Hispanic: '#f97316',
    Asian: '#f59e0b',
    'Native American': '#8b5cf6',
    'Pacific Islander': '#06b6d4',
    Other: '#a78bfa',
    Unknown: '#9ca3af',
  },
  chart: {
    blue: '#7777AB',
    steelBlue: 'steelblue',
    navy: 'navy',
    darkBlue: 'darkblue',
    darkGreen: 'darkgreen',
    darkRed: 'darkred',
  },
};

// Dark mode colors
export const DARK_LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#e5e7eb' },
  xaxis: {
    gridcolor: '#374151',
    linecolor: '#4b5563',
    tickcolor: '#9ca3af',
  },
  yaxis: {
    gridcolor: '#374151',
    linecolor: '#4b5563',
    tickcolor: '#9ca3af',
  },
};

export const LIGHT_LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#374151' },
  xaxis: {
    gridcolor: '#e5e7eb',
    linecolor: '#d1d5db',
    tickcolor: '#6b7280',
  },
  yaxis: {
    gridcolor: '#e5e7eb',
    linecolor: '#d1d5db',
    tickcolor: '#6b7280',
  },
};
