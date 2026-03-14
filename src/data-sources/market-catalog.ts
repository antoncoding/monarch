import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarkets } from '@/data-sources/envio/market';
import { fetchMorphoMarkets, fetchMorphoMarketsMultiChain } from '@/data-sources/morpho-api/market';
import { mergeMarketsByIdentity } from '@/data-sources/shared/market-merge';
import { filterTokenBlacklistedMarkets } from '@/data-sources/shared/market-visibility';
import { enrichMarketsWithHistoricalApysWithinTimeout } from '@/data-sources/shared/market-rate-enrichment';
import { enrichMarketsWithTargetRate } from '@/data-sources/shared/market-target-rate-enrichment';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const MARKET_ENRICHMENT_TIMEOUT_MS = 8_000;

const enrichCatalogMarkets = async (markets: Market[], customRpcUrls?: CustomRpcUrls): Promise<Market[]> => {
  const marketsWithTargetRate = await enrichMarketsWithTargetRate(markets, {
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
  const enrichedMarkets = await enrichCatalogMarkets(markets, customRpcUrls);

  logDataSourceEvent('market-catalog', 'market enrichment completed', {
    ...details,
    count: enrichedMarkets.length,
    durationMs: Date.now() - enrichmentStartedAt,
  });

  return enrichedMarkets;
};

const getMissingChainIds = (chainIds: SupportedNetworks[], markets: Market[]): SupportedNetworks[] => {
  const coveredChainIds = new Set(markets.map((market) => market.morphoBlue.chain.id));
  return chainIds.filter((chainId) => !coveredChainIds.has(chainId));
};

const fetchMarketsPerNetworkFallback = async (chainIds: SupportedNetworks[]): Promise<Market[]> => {
  const results = await Promise.allSettled(
    chainIds.map(async (network) => {
      if (supportsMorphoApi(network)) {
        try {
          return await fetchMorphoMarkets(network);
        } catch {
          return fetchSubgraphMarkets(network);
        }
      }

      return fetchSubgraphMarkets(network);
    }),
  );

  return filterTokenBlacklistedMarkets(results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
};

export const fetchMarketCatalog = async (
  chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS,
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<Market[]> => {
  const { customRpcUrls } = options;

  if (hasEnvioIndexer()) {
    try {
      const envioFetchStartedAt = Date.now();
      const envioMarkets = await fetchEnvioMarkets(chainIds, {
        customRpcUrls,
      });
      const envioFetchDurationMs = Date.now() - envioFetchStartedAt;
      const missingChainIds = getMissingChainIds(chainIds, envioMarkets);

      if (missingChainIds.length === 0 && envioMarkets.length > 0) {
        logDataSourceEvent('market-catalog', 'Envio fetch completed; using Envio as primary source', {
          chainIds: chainIds.join(','),
          count: envioMarkets.length,
          durationMs: envioFetchDurationMs,
        });

        return enrichCatalogMarketsWithLogging(envioMarkets, customRpcUrls, {
          chainIds: chainIds.join(','),
          source: 'envio-primary',
        });
      }

      logDataSourceEvent('market-catalog', 'Envio fetch completed with incomplete coverage; falling back for missing chains only', {
        requestedChainIds: chainIds.join(','),
        coveredChainIds: [...new Set(envioMarkets.map((market) => market.morphoBlue.chain.id))].join(','),
        missingChainIds: missingChainIds.join(','),
        envioCount: envioMarkets.length,
        durationMs: envioFetchDurationMs,
      });

      const fallbackMarkets = missingChainIds.length > 0 ? await fetchMarketsPerNetworkFallback(missingChainIds) : [];
      const mergedMarkets = mergeMarketsByIdentity([...envioMarkets, ...fallbackMarkets]);

      if (mergedMarkets.length > 0) {
        logDataSourceEvent('market-catalog', 'merged Envio with fallback markets', {
          fallbackCount: fallbackMarkets.length,
          totalCount: mergedMarkets.length,
        });

        return enrichCatalogMarketsWithLogging(mergedMarkets, customRpcUrls, {
          chainIds: chainIds.join(','),
          source: 'envio-merged-fallback',
        });
      }
    } catch (error) {
      logDataSourceEvent('market-catalog', 'Envio market catalog failed, using legacy fallback', {
        chainIds: chainIds.join(','),
        reason: getErrorMessage(error),
      });
    }
  } else {
    logDataSourceEvent('market-catalog', 'Envio endpoint not configured, using legacy sources', {
      chainIds: chainIds.join(','),
    });
  }

  const morphoSupportedChainIds = chainIds.filter(supportsMorphoApi);
  const subgraphOnlyChainIds = chainIds.filter((chainId) => !supportsMorphoApi(chainId));
  const markets: Market[] = [];

  if (morphoSupportedChainIds.length > 0) {
    try {
      markets.push(...(await fetchMorphoMarketsMultiChain(morphoSupportedChainIds)));
      logDataSourceEvent('market-catalog', 'used Morpho API fallback for supported chains', {
        chainIds: morphoSupportedChainIds.join(','),
      });
    } catch (error) {
      logDataSourceEvent('market-catalog', 'Morpho multi-chain fallback failed, retrying per-network fallback', {
        chainIds: morphoSupportedChainIds.join(','),
        reason: getErrorMessage(error),
      });
      markets.push(...(await fetchMarketsPerNetworkFallback(morphoSupportedChainIds)));
    }
  }

  if (subgraphOnlyChainIds.length > 0) {
    const subgraphResults = await Promise.allSettled(subgraphOnlyChainIds.map((network) => fetchSubgraphMarkets(network)));
    markets.push(...filterTokenBlacklistedMarkets(subgraphResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))));

    logDataSourceEvent('market-catalog', 'used subgraph fallback for non-Morpho chains', {
      chainIds: subgraphOnlyChainIds.join(','),
    });
  }

  const mergedMarkets = mergeMarketsByIdentity(markets);

  if (mergedMarkets.length > 0) {
    return enrichCatalogMarketsWithLogging(mergedMarkets, customRpcUrls, {
      chainIds: chainIds.join(','),
      source: 'legacy-fallback',
    });
  }

  return fetchMarketsPerNetworkFallback(chainIds);
};
