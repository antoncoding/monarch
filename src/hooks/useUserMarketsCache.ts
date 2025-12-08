import { useCallback } from 'react';
import storage from 'local-storage-fallback';
import { CacheMarketPositionKeys } from '../utils/storageKeys';

type MarketIdentifier = {
  marketUniqueKey: string;
  chainId: number;
};

type UserMarketsCache = Record<string, MarketIdentifier[]>;

export function useUserMarketsCache(address: string | undefined) {
  const userAddress = address?.toLowerCase() ?? '';

  // Load cache from localStorage
  const loadCache = useCallback((): UserMarketsCache => {
    try {
      const cached = storage.getItem(CacheMarketPositionKeys);
      if (cached) {
        return JSON.parse(cached) as UserMarketsCache;
      }
    } catch (error) {
      console.error('Failed to load markets cache:', error);
    }
    return {};
  }, []);

  // Save cache to localStorage
  const saveCache = useCallback((cache: UserMarketsCache) => {
    try {
      storage.setItem(CacheMarketPositionKeys, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to save markets cache:', error);
    }
  }, []);

  // Add markets to the user's known list
  const addUserMarkets = useCallback(
    (markets: MarketIdentifier[]) => {
      if (!userAddress) return;

      const cache = loadCache();
      const userMarkets = cache[userAddress] ?? [];

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
        cache[userAddress] = updatedMarkets;
        saveCache(cache);
      }
    },
    [userAddress, loadCache, saveCache],
  );

  // Get markets for the current user
  const getUserMarkets = useCallback((): MarketIdentifier[] => {
    if (!userAddress) return [];

    const cache = loadCache();
    return cache[userAddress] ?? [];
  }, [userAddress, loadCache]);

  // Update cache with markets from API response
  const batchAddUserMarkets = useCallback(
    (apiMarkets: { marketUniqueKey: string; chainId: number }[]) => {
      if (!userAddress || !apiMarkets.length) return;

      addUserMarkets(
        apiMarkets.map((market) => ({
          marketUniqueKey: market.marketUniqueKey,
          chainId: market.chainId,
        })),
      );
    },
    [userAddress, addUserMarkets],
  );

  return {
    addUserMarkets,
    getUserMarkets,
    batchAddUserMarkets,
  };
}
