import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type MarketIdentifier = {
  marketUniqueKey: string;
  chainId: number;
};

type UserMarketsCache = Record<string, MarketIdentifier[]>;

type UserMarketsCacheState = {
  cache: UserMarketsCache;
};

type UserMarketsCacheActions = {
  addUserMarkets: (address: string, markets: MarketIdentifier[]) => void;
  getUserMarkets: (address: string) => MarketIdentifier[];
  batchAddUserMarkets: (address: string, markets: MarketIdentifier[]) => void;

  // Bulk update for migration
  setAll: (state: Partial<UserMarketsCacheState>) => void;
};

type UserMarketsCacheStore = UserMarketsCacheState & UserMarketsCacheActions;

/**
 * Zustand store for caching user's market positions.
 * Stores a mapping of user addresses to their market identifiers.
 */
export const useUserMarketsCacheStore = create<UserMarketsCacheStore>()(
  persist(
    (set, get) => ({
      // Default state
      cache: {},

      // Actions
      addUserMarkets: (address, markets) => {
        const userAddress = address.toLowerCase();

        set((state) => {
          const userMarkets = state.cache[userAddress] ?? [];
          const updatedMarkets = [...userMarkets];
          let hasChanges = false;

          markets.forEach((market) => {
            // Check if market already exists
            const exists = updatedMarkets.some((m) => m.marketUniqueKey === market.marketUniqueKey && m.chainId === market.chainId);

            if (!exists) {
              updatedMarkets.push(market);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            return {
              cache: {
                ...state.cache,
                [userAddress]: updatedMarkets,
              },
            };
          }

          return state;
        });
      },

      getUserMarkets: (address) => {
        if (!address) return [];
        const userAddress = address.toLowerCase();
        return get().cache[userAddress] ?? [];
      },

      batchAddUserMarkets: (address, markets) => {
        get().addUserMarkets(address, markets);
      },

      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_userMarketsCache',
    },
  ),
);

/**
 * Convenience hook with scoped API for a specific user address.
 * Maintains backward-compatible interface with the old localStorage-based hook.
 *
 * @example
 * ```tsx
 * const { addUserMarkets, getUserMarkets } = useUserMarketsCache(userAddress);
 * ```
 */
export function useUserMarketsCache(address: string | undefined) {
  const userAddress = address?.toLowerCase() ?? '';

  const addMarkets = useUserMarketsCacheStore((s) => s.addUserMarkets);
  const getMarkets = useUserMarketsCacheStore((s) => s.getUserMarkets);
  const batchAdd = useUserMarketsCacheStore((s) => s.batchAddUserMarkets);

  return {
    addUserMarkets: useCallback(
      (markets: MarketIdentifier[]) => {
        if (!userAddress) return;
        addMarkets(userAddress, markets);
      },
      [addMarkets, userAddress],
    ),

    getUserMarkets: useCallback((): MarketIdentifier[] => {
      if (!userAddress) return [];
      return getMarkets(userAddress);
    }, [getMarkets, userAddress]),

    batchAddUserMarkets: useCallback(
      (apiMarkets: { marketUniqueKey: string; chainId: number }[]) => {
        if (!userAddress || !apiMarkets.length) return;
        batchAdd(userAddress, apiMarkets);
      },
      [batchAdd, userAddress],
    ),
  };
}
