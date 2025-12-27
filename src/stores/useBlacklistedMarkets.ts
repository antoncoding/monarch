import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { blacklistedMarkets as defaultBlacklistedMarkets } from '@/utils/markets';

export type BlacklistedMarket = {
  uniqueKey: string;
  chainId: number;
  reason?: string;
  addedAt: number;
};

type BlacklistedMarketsState = {
  customBlacklistedMarkets: BlacklistedMarket[];
};

type BlacklistedMarketsActions = {
  addBlacklistedMarket: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  removeBlacklistedMarket: (uniqueKey: string) => void;
  isBlacklisted: (uniqueKey: string) => boolean;
  isDefaultBlacklisted: (uniqueKey: string) => boolean;
  getAllBlacklistedKeys: () => Set<string>;
  setAll: (state: Partial<BlacklistedMarketsState>) => void;
};

type BlacklistedMarketsStore = BlacklistedMarketsState & BlacklistedMarketsActions;

/**
 * Zustand store for blacklisted markets.
 * Automatically persisted to localStorage.
 */
export const useBlacklistedMarkets = create<BlacklistedMarketsStore>()(
  persist(
    (set, get) => ({
      customBlacklistedMarkets: [],

      addBlacklistedMarket: (uniqueKey, chainId, reason) => {
        const state = get();
        const allKeys = state.getAllBlacklistedKeys();

        if (allKeys.has(uniqueKey)) {
          return false;
        }

        const newMarket: BlacklistedMarket = {
          uniqueKey,
          chainId,
          reason,
          addedAt: Date.now(),
        };

        set((prevState) => ({
          customBlacklistedMarkets: [...prevState.customBlacklistedMarkets, newMarket],
        }));

        return true;
      },

      removeBlacklistedMarket: (uniqueKey) => {
        set((state) => ({
          customBlacklistedMarkets: state.customBlacklistedMarkets.filter((m) => m.uniqueKey !== uniqueKey),
        }));
      },

      isBlacklisted: (uniqueKey) => {
        const state = get();
        return state.getAllBlacklistedKeys().has(uniqueKey);
      },

      isDefaultBlacklisted: (uniqueKey) => {
        return defaultBlacklistedMarkets.includes(uniqueKey);
      },

      getAllBlacklistedKeys: () => {
        const state = get();
        const customKeys = state.customBlacklistedMarkets.map((m) => m.uniqueKey);
        return new Set([...defaultBlacklistedMarkets, ...customKeys]);
      },

      setAll: (newState) => set(newState),
    }),
    {
      name: 'monarch_store_blacklistedMarkets',
    },
  ),
);
