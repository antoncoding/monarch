import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioUserPositionMarkets } from '@/data-sources/envio/positions';
import { fetchMorphoUserPositionMarkets } from '@/data-sources/morpho-api/positions';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
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
      const positionMarkets = dedupePositionMarkets(await fetchEnvioUserPositionMarkets(user, chainIds));
      logDataSourceEvent('position-markets', 'using Envio cross-chain position discovery', {
        chainIds: chainIds.join(','),
        count: positionMarkets.length,
      });
      return positionMarkets;
    } catch (error) {
      logDataSourceEvent('position-markets', 'Envio cross-chain position discovery failed, falling back', {
        chainIds: chainIds.join(','),
        reason: getErrorMessage(error),
      });
    }
  }

  logDataSourceEvent('position-markets', 'using per-network position discovery fallback', {
    chainIds: chainIds.join(','),
  });
  return fetchPositionMarketsPerNetworkFallback(user, chainIds);
};
