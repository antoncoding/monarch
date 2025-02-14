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
import { marketsQuery } from '@/graphql/queries';
import useLiquidations from '@/hooks/useLiquidations';
import { isSupportedChain } from '@/utils/networks';
import { Market } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

type MarketsContextType = {
  markets: Market[];
  loading: boolean;
  isRefetching: boolean;
  error: unknown | null;
  refetch: (onSuccess?: () => void) => void;
  refresh: () => Promise<void>;
};

const MarketsContext = createContext<MarketsContextType | undefined>(undefined);

type MarketsProviderProps = {
  children: ReactNode;
};

type MarketResponse = {
  data: {
    markets: {
      items: Market[];
    };
  };
};

export function MarketsProvider({ children }: MarketsProviderProps) {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const {
    loading: liquidationsLoading,
    liquidatedMarketIds,
    error: liquidationsError,
    refetch: refetchLiquidations,
  } = useLiquidations();

  const fetchMarkets = useCallback(
    async (isRefetch = false) => {
      try {
        if (isRefetch) {
          setIsRefetching(true);
        } else {
          setLoading(true);
        }

        const marketsResponse = await fetch('https://blue-api.morpho.org/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: marketsQuery,
            variables: { first: 1000, where: { whitelisted: true } },
          }),
        });

        const marketsResult = (await marketsResponse.json()) as MarketResponse;
        const rawMarkets = marketsResult.data.markets.items;

        const filtered = rawMarkets
          .filter((market) => market.collateralAsset != undefined)
          .filter(
            (market) => market.warnings.find((w) => w.type === 'not_whitelisted') === undefined,
          )
          .filter((market) => isSupportedChain(market.morphoBlue.chain.id));

        const processedMarkets = filtered.map((market) => {
          const warningsWithDetail = getMarketWarningsWithDetail(market);
          const isProtectedByLiquidationBots = liquidatedMarketIds.has(market.id);

          return {
            ...market,
            warningsWithDetail,
            isProtectedByLiquidationBots,
          };
        });

        setMarkets(processedMarkets);
      } catch (_error) {
        setError(_error);
      } finally {
        if (isRefetch) {
          setIsRefetching(false);
        } else {
          setLoading(false);
        }
      }
    },
    [liquidatedMarketIds],
  );

  useEffect(() => {
    if (!liquidationsLoading && markets.length === 0) {
      fetchMarkets().catch(console.error);
    }
  }, [liquidationsLoading, fetchMarkets]);

  const refetch = useCallback(
    (onSuccess?: () => void) => {
      refetchLiquidations();
      fetchMarkets(true).then(onSuccess).catch(console.error);
    },
    [refetchLiquidations, fetchMarkets],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setMarkets([]);
    try {
      await fetchMarkets();
    } catch (_error) {
      console.error('Failed to refresh markets:', _error);
    }
  }, [fetchMarkets]);

  const isLoading = loading || liquidationsLoading;
  const combinedError = error || liquidationsError;

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      markets,
      loading: isLoading,
      isRefetching,
      error: combinedError,
      refetch,
      refresh,
    }),
    [markets, isLoading, isRefetching, combinedError, refetch, refresh],
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
