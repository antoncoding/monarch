import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import {
  fetchMarketRateEnrichment,
  getMarketRateEnrichmentKey,
  type MarketRateEnrichmentMap,
} from '@/utils/market-rate-enrichment';
import type { Market } from '@/utils/types';

const EMPTY_ENRICHMENT_MAP: MarketRateEnrichmentMap = new Map();

export const useMarketRateEnrichmentQuery = (markets: Market[]) => {
  const { customRpcUrls, rpcConfigVersion } = useCustomRpcContext();

  const marketIdentity = useMemo(
    () =>
      markets
        .map((market) => getMarketRateEnrichmentKey(market.uniqueKey, market.morphoBlue.chain.id))
        .sort(),
    [markets],
  );

  return useQuery({
    queryKey: ['market-rate-enrichment', marketIdentity, rpcConfigVersion],
    queryFn: async () => fetchMarketRateEnrichment(markets, customRpcUrls),
    enabled: markets.length > 0,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData ?? EMPTY_ENRICHMENT_MAP,
  });
};
