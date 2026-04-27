import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportedNetworks } from '@/utils/supported-networks';

export type MarketFilterPreferencesState = {
  selectedCollaterals: string[];
  selectedLoanAssets: string[];
  selectedNetwork: SupportedNetworks | null;
};

type MarketFilterPreferencesActions = {
  applySelections: (state: Partial<MarketFilterPreferencesState>) => void;
  reset: () => void;
  setSelectedCollaterals: (collaterals: string[]) => void;
  setSelectedLoanAssets: (assets: string[]) => void;
  setSelectedNetwork: (network: SupportedNetworks | null) => void;
};

type MarketFilterPreferencesStore = MarketFilterPreferencesState & MarketFilterPreferencesActions;

const dedupeSelections = (values: string[]) => [...new Set(values)];

const DEFAULT_STATE: MarketFilterPreferencesState = {
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
          selectedNetwork: 'selectedNetwork' in state ? (state.selectedNetwork ?? null) : currentState.selectedNetwork,
          selectedLoanAssets:
            'selectedLoanAssets' in state ? dedupeSelections(state.selectedLoanAssets ?? []) : currentState.selectedLoanAssets,
          selectedCollaterals:
            'selectedCollaterals' in state ? dedupeSelections(state.selectedCollaterals ?? []) : currentState.selectedCollaterals,
        })),
      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'monarch_store_marketFilterPreferences',
      version: 1,
      migrate: (state) => {
        if (!state || typeof state !== 'object') {
          return DEFAULT_STATE;
        }
        return { ...DEFAULT_STATE, ...(state as Partial<MarketFilterPreferencesState>) };
      },
    },
  ),
);
