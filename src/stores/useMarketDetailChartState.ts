import { create } from 'zustand';
import type { TimeseriesOptions } from '@/utils/types';

const HOUR_IN_SECONDS = 60 * 60;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;
const MONTH_IN_SECONDS = 30 * DAY_IN_SECONDS;

export type ChartTimeframe = '1d' | '7d' | '30d' | '3m' | '6m';

/**
 * Timeframe configuration for on-chain historical data fetching.
 * Defines the interval between data points for each timeframe.
 */
export const TIMEFRAME_CONFIG: Record<
  ChartTimeframe,
  {
    durationSeconds: number;
    intervalSeconds: number;
    label: string;
  }
> = {
  '1d': {
    durationSeconds: DAY_IN_SECONDS,
    intervalSeconds: HOUR_IN_SECONDS, // every hour = 24 points
    label: '1D',
  },
  '7d': {
    durationSeconds: WEEK_IN_SECONDS,
    intervalSeconds: 4 * HOUR_IN_SECONDS, // every 4 hours = 42 points
    label: '7D',
  },
  '30d': {
    durationSeconds: 30 * DAY_IN_SECONDS,
    intervalSeconds: DAY_IN_SECONDS, // every day = 30 points
    label: '30D',
  },
  '3m': {
    durationSeconds: 3 * MONTH_IN_SECONDS,
    intervalSeconds: 3 * DAY_IN_SECONDS, // every 3 days = 30 points
    label: '3M',
  },
  '6m': {
    durationSeconds: 6 * MONTH_IN_SECONDS,
    intervalSeconds: 6 * DAY_IN_SECONDS, // every 6 days = 30 points
    label: '6M',
  },
};

/**
 * Calculate time points for a given timeframe.
 * Returns array of target timestamps from oldest to newest.
 */
export function calculateTimePoints(timeframe: ChartTimeframe, endTimestamp?: number): number[] {
  const config = TIMEFRAME_CONFIG[timeframe];
  const end = endTimestamp ?? Math.floor(Date.now() / 1000);
  const start = end - config.durationSeconds;
  const points: number[] = [];

  for (let t = start; t <= end; t += config.intervalSeconds) {
    points.push(t);
  }

  return points;
}

// Helper to calculate time range based on timeframe string
const calculateTimeRange = (timeframe: ChartTimeframe): TimeseriesOptions => {
  const endTimestamp = Math.floor(Date.now() / 1000);
  const config = TIMEFRAME_CONFIG[timeframe];
  const startTimestamp = endTimestamp - config.durationSeconds;
  const interval: TimeseriesOptions['interval'] = config.intervalSeconds >= DAY_IN_SECONDS ? 'DAY' : 'HOUR';

  return { startTimestamp, endTimestamp, interval };
};

type ChartState = {
  selectedTimeframe: ChartTimeframe;
  selectedTimeRange: TimeseriesOptions;
  volumeView: 'USD' | 'Asset';
};

type ChartActions = {
  setTimeframe: (timeframe: ChartTimeframe) => void;
  setVolumeView: (view: 'USD' | 'Asset') => void;
};

type MarketDetailChartStore = ChartState & ChartActions;

/**
 * [No persist] Zustand store for market detail chart state (shared between VolumeChart and RateChart).
 *
 */
export const useMarketDetailChartState = create<MarketDetailChartStore>((set) => ({
  // Default state
  selectedTimeframe: '7d',
  selectedTimeRange: calculateTimeRange('7d'),
  volumeView: 'Asset',

  // Actions
  setTimeframe: (timeframe) => {
    set({
      selectedTimeframe: timeframe,
      selectedTimeRange: calculateTimeRange(timeframe),
    });
  },

  setVolumeView: (view) => {
    set({ volumeView: view });
  },
}));
