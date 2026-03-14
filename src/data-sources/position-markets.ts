import { hasEnvioIndexer } from '@/config/dataSources';
import { fetchEnvioUserPositionMarkets } from '@/data-sources/envio/positions';
import { fetchMorphoUserPositionMarketsMultiChain } from '@/data-sources/morpho-api/positions';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';

type PositionMarket = {
  marketUniqueKey: string;
  chainId: number;
};

const ENVIO_POSITION_DISCOVERY_TIMEOUT_MS = 12_000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
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

export const fetchUserPositionMarkets = async (
  user: string,
  chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS,
): Promise<PositionMarket[]> => {
  logDataSourceEvent('position-markets', 'fetching user position markets', {
    chainIds: chainIds.join(','),
    hasEnvioIndexer: hasEnvioIndexer(),
  });

  if (hasEnvioIndexer()) {
    try {
      const positionMarkets = dedupePositionMarkets(
        await withTimeout(
          fetchEnvioUserPositionMarkets(user, chainIds),
          ENVIO_POSITION_DISCOVERY_TIMEOUT_MS,
          'Envio position discovery',
        ),
      );
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

  logDataSourceEvent('position-markets', 'using Morpho cross-chain position discovery fallback', {
    chainIds: chainIds.join(','),
  });
  return dedupePositionMarkets(await fetchMorphoUserPositionMarketsMultiChain(user, chainIds));
};
