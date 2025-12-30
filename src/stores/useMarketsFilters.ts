import { create } from 'zustand';
import type { SupportedNetworks } from '@/utils/networks';
import type { PriceFeedVendors } from '@/utils/oracle';

/**
 * Temporary filter state for markets page (resets on refresh for lightning-fast UX).
 *
 * Separation from useMarketPreferences:
 * - useMarketPreferences: UI preferences (sort, view mode, USD thresholds, column visibility) - persisted
 * - useMarketsFilters: Data filters (which assets/network to view, search query) - temporary
 */
type MarketsFiltersState = {
  selectedCollaterals: string[];
  selectedLoanAssets: string[];
  selectedNetwork: SupportedNetworks | null;
  selectedOracles: PriceFeedVendors[];
  searchQuery: string;
};

type MarketsFiltersActions = {
  setSelectedCollaterals: (collaterals: string[]) => void;
  setSelectedLoanAssets: (assets: string[]) => void;
  setSelectedNetwork: (network: SupportedNetworks | null) => void;
  setSelectedOracles: (oracles: PriceFeedVendors[]) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
};

type MarketsFiltersStore = MarketsFiltersState & MarketsFiltersActions;

const DEFAULT_STATE: MarketsFiltersState = {
  selectedCollaterals: [],
  selectedLoanAssets: [],
  selectedNetwork: null,
  selectedOracles: [],
  searchQuery: '',
};

/**
 * Zustand store for market filters (temporary, resets on refresh).
 *
 * @example
 * ```tsx
 * const { selectedCollaterals, setSelectedCollaterals } = useMarketsFilters();
 * const { searchQuery, setSearchQuery, resetFilters } = useMarketsFilters();
 * ```
 */
export const useMarketsFilters = create<MarketsFiltersStore>()((set) => ({
  // Default state
  ...DEFAULT_STATE,

  // Actions
  setSelectedCollaterals: (collaterals) =>
    set({
      selectedCollaterals: [...new Set(collaterals)], // Remove duplicates
    }),

  setSelectedLoanAssets: (assets) =>
    set({
      selectedLoanAssets: [...new Set(assets)], // Remove duplicates
    }),

  setSelectedNetwork: (network) =>
    set({
      selectedNetwork: network,
    }),

  setSelectedOracles: (oracles) =>
    set({
      selectedOracles: oracles,
    }),

  setSearchQuery: (query) =>
    set({
      searchQuery: query,
    }),

  resetFilters: () => set(DEFAULT_STATE),
}));
