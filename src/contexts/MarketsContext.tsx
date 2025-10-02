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
import useLiquidations from '@/hooks/useLiquidations';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { monarchWhitelistedMarkets, blacklistedMarkets } from '@/utils/markets';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain } from '@/utils/networks';
import { Market } from '@/utils/types';

// Export the type definition
export type MarketsContextType = {
  markets: Market[]; // Computed based on showUnwhitelistedMarkets setting
  whitelistedMarkets: Market[]; // Always whitelisted markets only
  allMarkets: Market[]; // All markets (whitelisted and unwhitelisted)
  loading: boolean;
  isRefetching: boolean;
  error: unknown | null;
  refetch: (onSuccess?: () => void) => void;
  refresh: () => Promise<void>;
  showUnwhitelistedMarkets: boolean;
  setShowUnwhitelistedMarkets: (value: boolean) => void;
  showFullRewardAPY: boolean;
  setShowFullRewardAPY: (value: boolean) => void;
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

  // Global setting for showing unwhitelisted markets
  const [showUnwhitelistedMarkets, setShowUnwhitelistedMarkets] = useLocalStorage(
    'showUnwhitelistedMarkets',
    false,
  );

  // Global setting for showing full reward APY (base + external rewards)
  const [showFullRewardAPY, setShowFullRewardAPY] = useLocalStorage('showFullRewardAPY', false);

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

        // Process combined markets (filters, warnings, liquidation status)
        // Existing filters seem appropriate
        const filtered = combinedMarkets
          .filter((market) => market.collateralAsset != undefined)
          .filter((market) => isSupportedChain(market.morphoBlue.chain.id)) // Keep this filter
          .filter((market) => !blacklistedMarkets.includes(market.uniqueKey));

        const processedMarkets = filtered.map((market) => {
          const isProtectedByLiquidationBots = liquidatedMarketKeys.has(market.uniqueKey);

          // only show this indicator when it's not already whitelisted
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

        // Set all markets (including unwhitelisted)
        setAllMarkets(processedMarkets);

        // Filter for whitelisted markets only
        const whitelisted = processedMarkets.filter((market) => market.whitelisted);
        setWhitelistedMarkets(whitelisted);

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
    [liquidatedMarketKeys],
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
      loading: isLoading,
      isRefetching,
      error: combinedError,
      refetch,
      refresh,
      showUnwhitelistedMarkets,
      setShowUnwhitelistedMarkets,
      showFullRewardAPY,
      setShowFullRewardAPY,
    }),
    [
      markets,
      whitelistedMarkets,
      allMarkets,
      isLoading,
      isRefetching,
      combinedError,
      refetch,
      refresh,
      showUnwhitelistedMarkets,
      setShowUnwhitelistedMarkets,
      showFullRewardAPY,
      setShowFullRewardAPY,
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
