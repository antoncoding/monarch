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
  /** Cached Set of all blacklisted keys (default + custom) */
  _cachedBlacklistedKeys: Set<string> | null;
};

type BlacklistedMarketsActions = {
  addBlacklistedMarket: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  removeBlacklistedMarket: (uniqueKey: string) => void;
  setShowBlacklistedPositions: (show: boolean) => void;
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
      showBlacklistedPositions: true,
      _cachedBlacklistedKeys: null,

      addBlacklistedMarket: (uniqueKey, chainId, reason) => {
        const state = get();
        const allKeys = state.getAllBlacklistedKeys();

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
          _cachedBlacklistedKeys: null, // Invalidate cache
        }));

        return true;
      },

      removeBlacklistedMarket: (uniqueKey) => {
        set((state) => ({
          customBlacklistedMarkets: state.customBlacklistedMarkets.filter((m) => m.uniqueKey !== uniqueKey),
          _cachedBlacklistedKeys: null, // Invalidate cache
        }));
      },

      setShowBlacklistedPositions: (show) => set({ showBlacklistedPositions: show }),

      isBlacklisted: (uniqueKey) => {
        const state = get();
        return state.getAllBlacklistedKeys().has(uniqueKey.toLowerCase());
      },

      isDefaultBlacklisted: (uniqueKey) => {
        return defaultBlacklistedMarkets.includes(uniqueKey);
      },

      getAllBlacklistedKeys: () => {
        const state = get();
        // Return cached Set if available
        if (state._cachedBlacklistedKeys) {
          return state._cachedBlacklistedKeys;
        }
        // Compute and cache the Set
        const newSet = getBlacklistedMarketKeys(state.customBlacklistedMarkets);
        // Update cache (using set() to avoid mutation)
        set({ _cachedBlacklistedKeys: newSet });
        return newSet;
      },

      setAll: (newState) => set({ ...newState, _cachedBlacklistedKeys: null }),
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
