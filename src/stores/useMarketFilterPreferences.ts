import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MARKET_DISCOVERY_CATEGORIES, type MarketDiscoveryCategory } from '@/features/markets/market-discovery';
import type { SupportedNetworks } from '@/utils/supported-networks';

export type MarketFilterPreferencesState = {
  discoveryCategories: MarketDiscoveryCategory[];
  selectedCollaterals: string[];
  selectedLoanAssets: string[];
  selectedNetwork: SupportedNetworks | null;
};

type MarketFilterPreferencesActions = {
  applySelections: (state: Partial<MarketFilterPreferencesState>) => void;
  clearDiscoveryCategories: () => void;
  reset: () => void;
  setSelectedCollaterals: (collaterals: string[]) => void;
  setSelectedLoanAssets: (assets: string[]) => void;
  setSelectedNetwork: (network: SupportedNetworks | null) => void;
  toggleDiscoveryCategory: (category: MarketDiscoveryCategory) => void;
};

type MarketFilterPreferencesStore = MarketFilterPreferencesState & MarketFilterPreferencesActions;

const dedupeSelections = (values: string[]) => [...new Set(values)];

const normalizeStringSelections = (values: unknown): string[] => {
  if (typeof values === 'string') {
    return [values];
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return dedupeSelections(values.filter((value): value is string => typeof value === 'string'));
};

const isMarketDiscoveryCategory = (value: unknown): value is MarketDiscoveryCategory =>
  typeof value === 'string' && (MARKET_DISCOVERY_CATEGORIES as readonly string[]).includes(value);

const normalizeDiscoveryCategories = (values: unknown): MarketDiscoveryCategory[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const categories: MarketDiscoveryCategory[] = [];
  for (const value of values) {
    if (isMarketDiscoveryCategory(value) && !categories.includes(value)) {
      categories.push(value);
    }
  }
  return categories;
};

const DEFAULT_STATE: MarketFilterPreferencesState = {
  discoveryCategories: [],
  selectedCollaterals: [],
  selectedLoanAssets: [],
  selectedNetwork: null,
};

export const useMarketFilterPreferences = create<MarketFilterPreferencesStore>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setSelectedCollaterals: (collaterals) => set({ selectedCollaterals: dedupeSelections(collaterals) }),
      setSelectedLoanAssets: (assets) => set({ selectedLoanAssets: dedupeSelections(assets) }),
      setSelectedNetwork: (network) => set({ selectedNetwork: network }),
      applySelections: (state) =>
        set((currentState) => ({
          discoveryCategories:
            'discoveryCategories' in state ? normalizeDiscoveryCategories(state.discoveryCategories) : currentState.discoveryCategories,
          selectedNetwork: 'selectedNetwork' in state ? (state.selectedNetwork ?? null) : currentState.selectedNetwork,
          selectedLoanAssets:
            'selectedLoanAssets' in state ? normalizeStringSelections(state.selectedLoanAssets) : currentState.selectedLoanAssets,
          selectedCollaterals:
            'selectedCollaterals' in state ? normalizeStringSelections(state.selectedCollaterals) : currentState.selectedCollaterals,
        })),
      toggleDiscoveryCategory: (category) =>
        set((state) => ({
          discoveryCategories: state.discoveryCategories.includes(category)
            ? state.discoveryCategories.filter((item) => item !== category)
            : [...state.discoveryCategories, category],
        })),
      clearDiscoveryCategories: () => set({ discoveryCategories: [] }),
      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'monarch_store_marketFilterPreferences',
      version: 2,
      migrate: (state) => {
        if (!state || typeof state !== 'object') {
          return DEFAULT_STATE;
        }
        const savedState = state as Partial<MarketFilterPreferencesState>;
        return {
          ...DEFAULT_STATE,
          ...savedState,
          discoveryCategories: normalizeDiscoveryCategories(savedState.discoveryCategories),
          selectedCollaterals: normalizeStringSelections(savedState.selectedCollaterals),
          selectedLoanAssets: normalizeStringSelections(savedState.selectedLoanAssets),
          selectedNetwork: savedState.selectedNetwork ?? null,
        };
      },
    },
  ),
);
