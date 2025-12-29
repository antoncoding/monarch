import { create } from 'zustand';
import type { TimeseriesOptions } from '@/utils/types';

const DAY_IN_SECONDS = 24 * 60 * 60;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;

// Helper to calculate time range based on timeframe string
const calculateTimeRange = (timeframe: '1d' | '7d' | '30d'): TimeseriesOptions => {
  const endTimestamp = Math.floor(Date.now() / 1000);
  let startTimestamp;
  let interval: TimeseriesOptions['interval'] = 'HOUR';
  switch (timeframe) {
    case '1d':
      startTimestamp = endTimestamp - DAY_IN_SECONDS;
      break;
    case '30d':
      startTimestamp = endTimestamp - 30 * DAY_IN_SECONDS;
      // Use DAY interval for longer ranges if desired, adjust as needed
      interval = 'DAY';
      break;
    default:
      startTimestamp = endTimestamp - WEEK_IN_SECONDS;
      break;
  }
  return { startTimestamp, endTimestamp, interval };
};

type ChartState = {
  selectedTimeframe: '1d' | '7d' | '30d';
  selectedTimeRange: TimeseriesOptions;
  volumeView: 'USD' | 'Asset';
};

type ChartActions = {
  setTimeframe: (timeframe: '1d' | '7d' | '30d') => void;
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
