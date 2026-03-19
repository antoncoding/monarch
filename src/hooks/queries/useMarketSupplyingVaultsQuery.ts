import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketSupplyingVaults, type MarketReference } from '@/data-sources/morpho-api/market-supplying-vaults';
import type { Market } from '@/utils/types';
import { getChainScopedMarketKey } from '@/utils/markets';

const EMPTY_SUPPLYING_VAULTS_MAP = new Map<string, string[]>();

const toMarketReferences = (markets: Market[]): MarketReference[] => {
  return markets
    .filter((market) => Boolean(market.uniqueKey))
    .map((market) => ({
      uniqueKey: market.uniqueKey,
      chainId: market.morphoBlue.chain.id,
    }));
};

export function useMarketSupplyingVaultsQuery(markets: Market[], enabled = true) {
  const requestedMarkets = useMemo(() => toMarketReferences(markets), [markets]);
  const requestedMarketsKey = useMemo(
    () =>
      requestedMarkets
        .map((market) => getChainScopedMarketKey(market.chainId, market.uniqueKey))
        .sort()
        .join(','),
    [requestedMarkets],
  );

  const query = useQuery<Map<string, string[]>, Error>({
    queryKey: ['market-supplying-vaults', requestedMarketsKey],
    queryFn: () => fetchMarketSupplyingVaults(requestedMarkets),
    enabled: enabled && requestedMarkets.length > 0,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData ?? EMPTY_SUPPLYING_VAULTS_MAP,
  });

  return {
    ...query,
    data: query.data ?? EMPTY_SUPPLYING_VAULTS_MAP,
  };
}
