import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { fetchMarketRateEnrichment, getMarketRateEnrichmentKey, type MarketRateEnrichmentMap } from '@/utils/market-rate-enrichment';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const EMPTY_ENRICHMENT_MAP: MarketRateEnrichmentMap = new Map();
const EMPTY_PENDING_CHAIN_IDS = new Set<number>();

export const useMarketRateEnrichmentQuery = (markets: Market[]) => {
  const { customRpcUrls } = useCustomRpcContext();
  const marketsByChain = useMemo(() => {
    const grouped = new Map<SupportedNetworks, Market[]>();

    markets.forEach((market) => {
      const chainId = market.morphoBlue.chain.id as SupportedNetworks;
      const chainMarkets = grouped.get(chainId) ?? [];
      chainMarkets.push(market);
      grouped.set(chainId, chainMarkets);
    });

    return Array.from(grouped.entries()).sort(([left], [right]) => left - right);
  }, [markets]);
  const enrichmentQueries = useQueries({
    queries: marketsByChain.map(([chainId, chainMarkets]) => {
      const marketIdentity = chainMarkets.map((market) => getMarketRateEnrichmentKey(market.uniqueKey, chainId)).sort();
      const customRpcUrl = customRpcUrls[chainId];

      return {
        queryKey: ['market-rate-enrichment', chainId, marketIdentity, customRpcUrl ?? null],
        queryFn: async () => fetchMarketRateEnrichment(chainMarkets, customRpcUrl ? { [chainId]: customRpcUrl } : {}),
        enabled: chainMarkets.length > 0,
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
      };
    }),
  });

  const data = useMemo(() => {
    if (enrichmentQueries.length === 0) {
      return EMPTY_ENRICHMENT_MAP;
    }

    const merged = new Map(EMPTY_ENRICHMENT_MAP);

    enrichmentQueries.forEach((query) => {
      if (!query.data) {
        return;
      }

      query.data.forEach((value, key) => {
        merged.set(key, value);
      });
    });

    return merged.size > 0 ? merged : EMPTY_ENRICHMENT_MAP;
  }, [enrichmentQueries]);

  const pendingChainIds = useMemo(() => {
    if (marketsByChain.length === 0) {
      return EMPTY_PENDING_CHAIN_IDS;
    }

    const pending = new Set<number>();

    marketsByChain.forEach(([chainId], index) => {
      const query = enrichmentQueries[index];
      if (!query || query.isPending || (!query.data && query.isFetching)) {
        pending.add(chainId);
      }
    });

    return pending.size > 0 ? pending : EMPTY_PENDING_CHAIN_IDS;
  }, [marketsByChain, enrichmentQueries]);

  const isFetching = enrichmentQueries.some((query) => query.isFetching);
  const isRefetching = enrichmentQueries.some((query) => query.isRefetching);
  const isLoading = data.size === 0 && pendingChainIds.size > 0;

  return {
    data,
    pendingChainIds,
    isLoading,
    isFetching,
    isRefetching,
  };
};
