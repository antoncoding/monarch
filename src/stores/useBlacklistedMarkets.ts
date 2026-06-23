import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { blacklistedMarkets as defaultBlacklistedMarkets } from '@/utils/markets';

export type BlacklistedMarket = {
  uniqueKey: string;
  chainId: number;
  reason?: string;
  addedAt: number;
};

export const getBlacklistedMarketKeys = (customBlacklistedMarkets: readonly Pick<BlacklistedMarket, 'uniqueKey'>[]): Set<string> => {
  return new Set(
    [...defaultBlacklistedMarkets, ...customBlacklistedMarkets.map((market) => market.uniqueKey)].map((key) => key.toLowerCase()),
  );
};

type BlacklistedMarketsState = {
  customBlacklistedMarkets: BlacklistedMarket[];
  showBlacklistedPositions: boolean;
};

type BlacklistedMarketsActions = {
  addBlacklistedMarket: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  removeBlacklistedMarket: (uniqueKey: string) => void;
  setShowBlacklistedPositions: (show: boolean) => void;
  isBlacklisted: (uniqueKey: string) => boolean;
  isDefaultBlacklisted: (uniqueKey: string) => boolean;
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
      showBlacklistedPositions: true,

      addBlacklistedMarket: (uniqueKey, chainId, reason) => {
        const state = get();
        const allKeys = getBlacklistedMarketKeys(state.customBlacklistedMarkets);

        if (allKeys.has(uniqueKey.toLowerCase())) {
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

      setShowBlacklistedPositions: (show) => set({ showBlacklistedPositions: show }),

      isBlacklisted: (uniqueKey) => {
        const state = get();
        return getBlacklistedMarketKeys(state.customBlacklistedMarkets).has(uniqueKey.toLowerCase());
      },

      isDefaultBlacklisted: (uniqueKey) => {
        return defaultBlacklistedMarkets.includes(uniqueKey);
      },
    }),
    {
      name: 'monarch_store_blacklistedMarkets',
      partialize: (state) => ({
        // Only persist customBlacklistedMarkets, not the cache
        customBlacklistedMarkets: state.customBlacklistedMarkets,
        showBlacklistedPositions: state.showBlacklistedPositions,
      }),
    },
  ),
);
