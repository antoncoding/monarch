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
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoMarkets } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import useLiquidations from '@/hooks/useLiquidations';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isSupportedChain, SupportedNetworks } from '@/utils/networks';
import { Market } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

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
      const networksToFetch: SupportedNetworks[] = [
        SupportedNetworks.Mainnet,
        SupportedNetworks.Base,
        SupportedNetworks.Polygon,
      ];
      let combinedMarkets: Market[] = [];
      let fetchErrors: unknown[] = [];

      try {
        // Fetch markets for each network based on its data source
        await Promise.all(
          networksToFetch.map(async (network) => {
            try {
              const dataSource = getMarketDataSource(network);
              let networkMarkets: Market[] = [];

              console.log(`Fetching markets for ${network} via ${dataSource}`);

              if (dataSource === 'morpho') {
                networkMarkets = await fetchMorphoMarkets(network);
              } else if (dataSource === 'subgraph') {
                networkMarkets = await fetchSubgraphMarkets(network);
              } else {
                console.warn(`No valid data source found for network ${network}`);
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
          .filter((market) => isSupportedChain(market.morphoBlue.chain.id)); // Keep this filter

        const processedMarkets = filtered.map((market) => {
          const warningsWithDetail = getMarketWarningsWithDetail(market); // Recalculate warnings if needed, though fetchers might do this
          const isProtectedByLiquidationBots = liquidatedMarketKeys.has(market.uniqueKey);

          return {
            ...market,
            // Ensure warningsWithDetail from fetchers are used or recalculated consistently
            warningsWithDetail: market.warningsWithDetail ?? warningsWithDetail,
            isProtectedByLiquidationBots,
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
      fetchMarkets().catch(console.error);
    }
  }, [liquidationsLoading, fetchMarkets, whitelistedMarkets.length]);

  const refetch = useCallback(
    async (onSuccess?: () => void) => {
      try {
        refetchLiquidations();
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
      refetchLiquidations();
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
