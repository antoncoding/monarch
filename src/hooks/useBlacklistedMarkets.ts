import { useCallback, useMemo } from 'react';
import { blacklistedMarkets as defaultBlacklistedMarkets } from '@/utils/markets';
import { useLocalStorage } from './useLocalStorage';

type BlacklistedMarket = {
  uniqueKey: string;
  chainId: number;
  reason?: string;
  addedAt: number;
};

export function useBlacklistedMarkets() {
  const [customBlacklistedMarkets, setCustomBlacklistedMarkets] = useLocalStorage<
    BlacklistedMarket[]
  >('customBlacklistedMarkets', []);

  // Combine default and custom blacklists
  const allBlacklistedMarketKeys = useMemo(() => {
    const customKeys = customBlacklistedMarkets.map((m) => m.uniqueKey);
    return new Set([...defaultBlacklistedMarkets, ...customKeys]);
  }, [customBlacklistedMarkets]);

  // Add a market to blacklist
  const addBlacklistedMarket = useCallback(
    (uniqueKey: string, chainId: number, reason?: string) => {
      // Check if already blacklisted
      if (allBlacklistedMarketKeys.has(uniqueKey)) {
        return false;
      }

      const newMarket: BlacklistedMarket = {
        uniqueKey,
        chainId,
        reason,
        addedAt: Date.now(),
      };

      setCustomBlacklistedMarkets((prev) => [...prev, newMarket]);
      return true;
    },
    [allBlacklistedMarketKeys, setCustomBlacklistedMarkets],
  );

  // Remove a custom blacklisted market (cannot remove defaults)
  const removeBlacklistedMarket = useCallback(
    (uniqueKey: string) => {
      setCustomBlacklistedMarkets((prev) => prev.filter((m) => m.uniqueKey !== uniqueKey));
    },
    [setCustomBlacklistedMarkets],
  );

  // Check if a market is blacklisted
  const isBlacklisted = useCallback(
    (uniqueKey: string) => {
      return allBlacklistedMarketKeys.has(uniqueKey);
    },
    [allBlacklistedMarketKeys],
  );

  // Check if a market is in default blacklist
  const isDefaultBlacklisted = useCallback((uniqueKey: string) => {
    return defaultBlacklistedMarkets.includes(uniqueKey);
  }, []);

  return {
    allBlacklistedMarketKeys,
    customBlacklistedMarkets,
    addBlacklistedMarket,
    removeBlacklistedMarket,
    isBlacklisted,
    isDefaultBlacklisted,
  };
}
