import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioUserPositionMarkets } from '@/data-sources/envio/positions';
import { fetchMorphoUserPositionMarkets } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphUserPositionMarkets } from '@/data-sources/subgraph/positions';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';

type PositionMarket = {
  marketUniqueKey: string;
  chainId: number;
};

const dedupePositionMarkets = (markets: PositionMarket[]): PositionMarket[] => {
  const uniqueMarkets = new Map<string, PositionMarket>();

  for (const market of markets) {
    const key = getChainScopedMarketKey(market.marketUniqueKey, market.chainId);
    if (!uniqueMarkets.has(key)) {
      uniqueMarkets.set(key, market);
    }
  }

  return Array.from(uniqueMarkets.values());
};

const fetchPositionMarketsPerNetworkFallback = async (
  user: string,
  chainIds: SupportedNetworks[],
): Promise<PositionMarket[]> => {
  const results = await Promise.allSettled(
    chainIds.map(async (network) => {
      if (supportsMorphoApi(network)) {
        try {
          return await fetchMorphoUserPositionMarkets(user, network);
        } catch {
          return fetchSubgraphUserPositionMarkets(user, network);
        }
      }

      return fetchSubgraphUserPositionMarkets(user, network);
    }),
  );

  return dedupePositionMarkets(results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
};

export const fetchUserPositionMarkets = async (
  user: string,
  chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS,
): Promise<PositionMarket[]> => {
  if (hasEnvioIndexer()) {
    try {
      return dedupePositionMarkets(await fetchEnvioUserPositionMarkets(user, chainIds));
    } catch (error) {
      console.error('[positions] Envio cross-chain fetch failed, falling back to per-network sources:', error);
    }
  }

  return fetchPositionMarketsPerNetworkFallback(user, chainIds);
};
