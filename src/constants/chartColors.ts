export const MONARCH_PRIMARY = '#f45f2d';

export const CHART_COLORS = {
  supply: {
    stroke: '#3B82F6',
    gradient: {
      start: '#3B82F6',
      startOpacity: 0.3,
      endOpacity: 0,
    },
  },
  borrow: {
    stroke: '#10B981',
    gradient: {
      start: '#10B981',
      startOpacity: 0.3,
      endOpacity: 0,
    },
  },
  apyAtTarget: {
    stroke: '#F59E0B',
    gradient: {
      start: '#F59E0B',
      startOpacity: 0.3,
      endOpacity: 0,
    },
  },
} as const;

export const PIE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#64748B', // Slate (for "Other")
] as const;

export const RISK_COLORS = {
  stroke: '#EF4444',
  gradient: {
    start: '#EF4444',
    startOpacity: 0.3,
    endOpacity: 0,
  },
} as const;
