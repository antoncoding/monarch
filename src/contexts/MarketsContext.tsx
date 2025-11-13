'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarkets } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import { useBlacklistedMarkets } from '@/hooks/useBlacklistedMarkets';
import useLiquidations from '@/hooks/useLiquidations';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { monarchWhitelistedMarkets } from '@/utils/markets';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain } from '@/utils/networks';
import { Market } from '@/utils/types';

// Export the type definition
export type MarketsContextType = {
  markets: Market[]; // Computed based on showUnwhitelistedMarkets setting
  whitelistedMarkets: Market[]; // Always whitelisted markets only
  allMarkets: Market[]; // All markets (whitelisted and unwhitelisted, excluding blacklisted)
  rawMarketsUnfiltered: Market[]; // Raw markets before blacklist filter (for blacklist management)
  loading: boolean;
  isRefetching: boolean;
  error: unknown | null;
  refetch: (onSuccess?: () => void) => void;
  refresh: () => Promise<void>;
  showUnwhitelistedMarkets: boolean;
  setShowUnwhitelistedMarkets: (value: boolean) => void;
  showFullRewardAPY: boolean;
  setShowFullRewardAPY: (value: boolean) => void;
  isBlacklisted: (uniqueKey: string) => boolean;
  addBlacklistedMarket: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  removeBlacklistedMarket: (uniqueKey: string) => void;
  isDefaultBlacklisted: (uniqueKey: string) => boolean;
};

const MarketsContext = createContext<MarketsContextType | undefined>(undefined);

type MarketsProviderProps = {
  children: ReactNode;
};

export function MarketsProvider({ children }: MarketsProviderProps) {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [whitelistedMarkets, setWhitelistedMarkets] = useState<Market[]>([]);
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [error, setError] = useState<unknown | null>(null);
  // Store raw unfiltered markets to avoid refetching when blacklist changes
  const [rawMarkets, setRawMarkets] = useState<Market[]>([]);

  // Global setting for showing unwhitelisted markets
  const [showUnwhitelistedMarkets, setShowUnwhitelistedMarkets] = useLocalStorage(
    'showUnwhitelistedMarkets',
    false,
  );

  // Global setting for showing full reward APY (base + external rewards)
  const [showFullRewardAPY, setShowFullRewardAPY] = useLocalStorage('showFullRewardAPY', false);

  // Blacklisted markets management
  const {
    allBlacklistedMarketKeys,
    addBlacklistedMarket,
    removeBlacklistedMarket,
    isBlacklisted,
    isDefaultBlacklisted,
  } = useBlacklistedMarkets();

  const {
    loading: liquidationsLoading,
    liquidatedMarketKeys,
    error: liquidationsError,
    refetch: refetchLiquidations,
  } = useLiquidations();

  // Computed markets based on the setting
  const markets = useMemo(() => {
    return showUnwhitelistedMarkets ? allMarkets : whitelistedMarkets;
  }, [showUnwhitelistedMarkets, allMarkets, whitelistedMarkets]);

  // Helper to add metadata (liquidation status, whitelist info) to markets
  const addMarketMetadata = useCallback(
    (marketsToEnrich: Market[]) => {
      return marketsToEnrich.map((market) => {
        const isProtectedByLiquidationBots = liquidatedMarketKeys.has(market.uniqueKey);
        const isMonarchWhitelisted =
          !market.whitelisted &&
          monarchWhitelistedMarkets.some(
            (whitelistedMarket) => whitelistedMarket.id === market.uniqueKey.toLowerCase(),
          );

        return {
          ...market,
          whitelisted: market.whitelisted || isMonarchWhitelisted,
          isProtectedByLiquidationBots,
          isMonarchWhitelisted,
        };
      });
    },
    [liquidatedMarketKeys],
  );

  // Process markets helper function
  const processMarkets = useCallback(
    (marketsToProcess: Market[]) => {
      // Apply basic filters (but not blacklist yet - that comes later)
      const baseFiltered = marketsToProcess
        .filter((market) => market.uniqueKey !== undefined)
        .filter((market) => market.loanAsset && market.collateralAsset)
        .filter((market) => isSupportedChain(market.morphoBlue.chain.id));

      // Store raw markets before blacklist filter
      setRawMarkets(baseFiltered);

      // Apply blacklist filter
      const blacklistFiltered = baseFiltered.filter(
        (market) => !allBlacklistedMarketKeys.has(market.uniqueKey),
      );

      // Add liquidation and whitelist status using the helper
      const processed = addMarketMetadata(blacklistFiltered);

      // Set all markets (including unwhitelisted)
      setAllMarkets(processed);

      // Filter for whitelisted markets only
      const whitelisted = processed.filter((market) => market.whitelisted);
      setWhitelistedMarkets(whitelisted);
    },
    [allBlacklistedMarketKeys, addMarketMetadata],
  );

  // Reapply blacklist filter without refetching
  const applyBlacklistFilter = useCallback(() => {
    if (rawMarkets.length === 0) return;

    // Apply blacklist filter to raw markets
    const blacklistFiltered = rawMarkets.filter(
      (market) => !allBlacklistedMarketKeys.has(market.uniqueKey),
    );

    // Add liquidation and whitelist status using the helper
    const processed = addMarketMetadata(blacklistFiltered);

    // Set all markets (including unwhitelisted)
    setAllMarkets(processed);

    // Filter for whitelisted markets only
    const whitelisted = processed.filter((market) => market.whitelisted);
    setWhitelistedMarkets(whitelisted);
  }, [rawMarkets, allBlacklistedMarketKeys, addMarketMetadata]);

  const fetchMarkets = useCallback(
    async (isRefetch = false) => {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setLoading(true);
      }
      setError(null); // Reset error at the start

      // Define the networks to fetch markets for
      
      let combinedMarkets: Market[] = [];
      let fetchErrors: unknown[] = [];

      try {
        // Fetch markets for each network based on its data source
        await Promise.all(
          ALL_SUPPORTED_NETWORKS.map(async (network) => {
            try {
              let networkMarkets: Market[] = [];

              // Try Morpho API first if supported
              if (supportsMorphoApi(network)) {
                try {
                  console.log(`Attempting to fetch markets via Morpho API for ${network}`);
                  networkMarkets = await fetchMorphoMarkets(network);
                } catch (morphoError) {
                  console.error(
                    `Failed to fetch markets via Morpho API for ${network}:`,
                    morphoError,
                  );
                  // Continue to Subgraph fallback
                }
              }

              // If Morpho API failed or not supported, try Subgraph
              if (networkMarkets.length === 0) {
                try {
                  console.log(`Attempting to fetch markets via Subgraph for ${network}`);
                  networkMarkets = await fetchSubgraphMarkets(network);
                  console.log(`Fetched ${networkMarkets.length} markets via Subgraph for ${network}`);
                } catch (subgraphError) {
                  console.error(
                    `Failed to fetch markets via Subgraph for ${network}:`,
                    subgraphError,
                  );
                  throw subgraphError; // Throw to be caught by outer catch
                }
              }

              combinedMarkets.push(...networkMarkets);
            } catch (networkError) {
              console.error(`Failed to fetch markets for network ${network}:`, networkError);
              fetchErrors.push(networkError); // Collect errors for each network
            }
          }),
        );

        // Process combined markets using the helper function
        processMarkets(combinedMarkets);

        // If any network fetch failed, set the overall error state
        if (fetchErrors.length > 0) {
          // Maybe combine errors or just take the first one
          setError(fetchErrors[0]);
        }
      } catch (err) {
        // Catch potential errors from Promise.all itself or overall logic
        console.error('Overall error fetching markets:', err);
        setError(err);
      } finally {
        if (isRefetch) {
          setIsRefetching(false);
        } else {
          setLoading(false);
        }
      }
    },
    [processMarkets],
  );

  useEffect(() => {
    if (!liquidationsLoading && whitelistedMarkets.length === 0) {
      void fetchMarkets().catch(console.error);
    }

    // Set up refresh interval
    const refreshInterval = setInterval(
      () => {
        void fetchMarkets(true).catch(console.error);
      },
      5 * 60 * 1000,
    ); // Refresh every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [liquidationsLoading, fetchMarkets, whitelistedMarkets.length]);

  // Automatically reapply blacklist filter when blacklist changes
  useEffect(() => {
    if (rawMarkets.length > 0) {
      applyBlacklistFilter();
    }
  }, [allBlacklistedMarketKeys, applyBlacklistFilter, rawMarkets.length]);

  const refetch = useCallback(
    async (onSuccess?: () => void) => {
      try {
        await refetchLiquidations();
        await fetchMarkets(true);
        onSuccess?.();
      } catch (err) {
        console.error('Error during refetch:', err);
      }
    },
    [refetchLiquidations, fetchMarkets],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setWhitelistedMarkets([]);
    setAllMarkets([]);
    setError(null);
    try {
      await refetchLiquidations();
      await fetchMarkets();
    } catch (_error) {
      console.error('Failed to refresh markets:', _error);
      setError(_error);
    } finally {
      setLoading(false);
    }
  }, [refetchLiquidations, fetchMarkets]);

  const isLoading = loading || liquidationsLoading;
  const combinedError = error || liquidationsError;

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      markets,
      whitelistedMarkets,
      allMarkets,
      rawMarketsUnfiltered: rawMarkets,
      loading: isLoading,
      isRefetching,
      error: combinedError,
      refetch,
      refresh,
      showUnwhitelistedMarkets,
      setShowUnwhitelistedMarkets,
      showFullRewardAPY,
      setShowFullRewardAPY,
      isBlacklisted,
      addBlacklistedMarket,
      removeBlacklistedMarket,
      isDefaultBlacklisted,
    }),
    [
      markets,
      whitelistedMarkets,
      allMarkets,
      rawMarkets,
      isLoading,
      isRefetching,
      combinedError,
      refetch,
      refresh,
      showUnwhitelistedMarkets,
      setShowUnwhitelistedMarkets,
      showFullRewardAPY,
      setShowFullRewardAPY,
      isBlacklisted,
      addBlacklistedMarket,
      removeBlacklistedMarket,
      isDefaultBlacklisted,
    ],
  );

  return <MarketsContext.Provider value={contextValue}>{children}</MarketsContext.Provider>;
}

export function useMarkets() {
  const context = useContext(MarketsContext);
  if (context === undefined) {
    throw new Error('useMarkets must be used within a MarketsProvider');
  }
  return context;
}
