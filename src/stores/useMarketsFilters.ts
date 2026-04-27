import { create } from 'zustand';
import type { PriceFeedVendors } from '@/utils/oracle';

/**
 * Session-only filter state for the markets page.
 *
 * Persisted market selections (network, loan asset, collateral) live in
 * useMarketFilterPreferences. This store holds the transient filters that
 * should reset naturally between sessions or when the user clears the page.
 */
type MarketsFiltersState = {
  selectedOracles: PriceFeedVendors[];
  searchQuery: string;
  trendingMode: boolean; // Official trending filter (backend-computed)
  customTagMode: boolean; // User's custom tag filter
  starredOnly: boolean; // Show only starred markets
};

type MarketsFiltersActions = {
  setSelectedOracles: (oracles: PriceFeedVendors[]) => void;
  setSearchQuery: (query: string) => void;
  toggleTrendingMode: () => void;
  toggleCustomTagMode: () => void;
  toggleStarredOnly: () => void;
  resetFilters: () => void;
};

type MarketsFiltersStore = MarketsFiltersState & MarketsFiltersActions;

const DEFAULT_STATE: MarketsFiltersState = {
  selectedOracles: [],
  searchQuery: '',
  trendingMode: false,
  customTagMode: false,
  starredOnly: false,
};

/**
 * Zustand store for market filters (temporary, resets on refresh).
 *
 * @example
 * ```tsx
 * const { searchQuery, setSearchQuery, resetFilters } = useMarketsFilters();
 * ```
 */
export const useMarketsFilters = create<MarketsFiltersStore>()((set) => ({
  ...DEFAULT_STATE,

  setSelectedOracles: (oracles) => set({ selectedOracles: oracles }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleTrendingMode: () => set((state) => ({ trendingMode: !state.trendingMode })),
  toggleCustomTagMode: () => set((state) => ({ customTagMode: !state.customTagMode })),
  toggleStarredOnly: () => set((state) => ({ starredOnly: !state.starredOnly })),

  resetFilters: () => set(DEFAULT_STATE),
}));
