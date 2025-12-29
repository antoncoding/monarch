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
  /** Cached Set of all blacklisted keys (default + custom) */
  _cachedBlacklistedKeys: Set<string> | null;
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
      _cachedBlacklistedKeys: null,

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

      isBlacklisted: (uniqueKey) => {
        const state = get();
        return state.getAllBlacklistedKeys().has(uniqueKey);
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
        const customKeys = state.customBlacklistedMarkets.map((m) => m.uniqueKey);
        const newSet = new Set([...defaultBlacklistedMarkets, ...customKeys]);
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
      }),
    },
  ),
);
