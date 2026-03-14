import { hasEnvioIndexer } from '@/config/dataSources';
import { fetchEnvioMarkets } from '@/data-sources/envio/market';
import { fetchMorphoMarketsMultiChain } from '@/data-sources/morpho-api/market';
import { toIndexedMarket } from '@/data-sources/shared/market-metadata';
import { filterTokenBlacklistedMarkets } from '@/data-sources/shared/market-visibility';
import { enrichMarketsWithHistoricalApysWithinTimeout } from '@/data-sources/shared/market-rate-enrichment';
import { enrichMarketsWithTargetRate } from '@/data-sources/shared/market-target-rate-enrichment';
import { fillMissingMarketUsdValues } from '@/data-sources/shared/market-usd';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const MARKET_ENRICHMENT_TIMEOUT_MS = 8_000;
const ENVIO_MARKET_CATALOG_TIMEOUT_MS = 12_000;

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

const enrichCatalogMarkets = async (markets: Market[], customRpcUrls?: CustomRpcUrls): Promise<Market[]> => {
  const marketsWithUsd = await fillMissingMarketUsdValues(markets);
  const marketsWithTargetRate = await enrichMarketsWithTargetRate(marketsWithUsd, {
    customRpcUrls,
  });

  return enrichMarketsWithHistoricalApysWithinTimeout(marketsWithTargetRate, MARKET_ENRICHMENT_TIMEOUT_MS, customRpcUrls);
};

const enrichCatalogMarketsWithLogging = async (
  markets: Market[],
  customRpcUrls: CustomRpcUrls | undefined,
  details: Record<string, unknown>,
): Promise<Market[]> => {
  const enrichmentStartedAt = Date.now();
  try {
    const enrichedMarkets = await enrichCatalogMarkets(markets, customRpcUrls);

    logDataSourceEvent('market-catalog', 'market enrichment completed', {
      ...details,
      count: enrichedMarkets.length,
      durationMs: Date.now() - enrichmentStartedAt,
    });

    return enrichedMarkets;
  } catch (error) {
    logDataSourceEvent('market-catalog', 'market enrichment failed, using base catalog', {
      ...details,
      count: markets.length,
      durationMs: Date.now() - enrichmentStartedAt,
      reason: getErrorMessage(error),
    });

    return markets;
  }
};

export const fetchMarketCatalog = async (
  chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS,
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<Market[]> => {
  const { customRpcUrls } = options;
  let indexedMarkets: Market[] = [];
  let source: 'envio' | 'morpho' = 'morpho';

  if (hasEnvioIndexer()) {
    try {
      const envioMarkets = filterTokenBlacklistedMarkets(
        (await withTimeout(
          fetchEnvioMarkets(chainIds, {
            customRpcUrls,
          }),
          ENVIO_MARKET_CATALOG_TIMEOUT_MS,
          'Envio market catalog',
        )).map(toIndexedMarket),
      );

      if (envioMarkets.length > 0) {
        logDataSourceEvent('market-catalog', 'using Envio market catalog', {
          chainIds: chainIds.join(','),
          count: envioMarkets.length,
        });

        indexedMarkets = envioMarkets;
        source = 'envio';
      } else {
        logDataSourceEvent('market-catalog', 'Envio market catalog returned no usable markets, falling back', {
          chainIds: chainIds.join(','),
        });
      }
    } catch (error) {
      logDataSourceEvent('market-catalog', 'Envio market catalog failed', {
        chainIds: chainIds.join(','),
        reason: getErrorMessage(error),
      });
    }
  } else {
    logDataSourceEvent('market-catalog', 'Envio endpoint not configured, using Morpho market catalog only', {
      chainIds: chainIds.join(','),
    });
  }

  if (indexedMarkets.length === 0) {
    const morphoFetchStartedAt = Date.now();

    try {
      indexedMarkets = filterTokenBlacklistedMarkets((await fetchMorphoMarketsMultiChain(chainIds)).map(toIndexedMarket));
      logDataSourceEvent('market-catalog', 'using Morpho market catalog fallback', {
        chainIds: chainIds.join(','),
        count: indexedMarkets.length,
        durationMs: Date.now() - morphoFetchStartedAt,
      });
    } catch (error) {
      logDataSourceEvent('market-catalog', 'Morpho market catalog fetch failed', {
        chainIds: chainIds.join(','),
        reason: getErrorMessage(error),
      });
    }
  }

  if (indexedMarkets.length > 0) {
    return enrichCatalogMarketsWithLogging(indexedMarkets, customRpcUrls, {
      chainIds: chainIds.join(','),
      source,
    });
  }

  throw new Error('Failed to fetch market catalog from Morpho API and Envio');
};
