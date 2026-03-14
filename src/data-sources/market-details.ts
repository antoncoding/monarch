import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarket } from '@/data-sources/envio/market';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { isTokenBlacklistedMarket } from '@/data-sources/shared/market-visibility';
import { fetchSubgraphMarket } from '@/data-sources/subgraph/market';
import { enrichMarketsWithHistoricalApysWithinTimeout } from '@/data-sources/shared/market-rate-enrichment';
import { enrichMarketsWithTargetRate } from '@/data-sources/shared/market-target-rate-enrichment';
import { fillMissingMarketUsdValues } from '@/data-sources/shared/market-usd';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const MARKET_ENRICHMENT_TIMEOUT_MS = 8_000;

export const fetchMarketDetails = async (
  uniqueKey: string,
  network: SupportedNetworks,
  options: {
    enrichHistoricalApys?: boolean;
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<Market | null> => {
  const { customRpcUrls, enrichHistoricalApys = false } = options;
  let baseMarket: Market | null = null;

  if (hasEnvioIndexer()) {
    try {
      baseMarket = await fetchEnvioMarket(uniqueKey, network, {
        customRpcUrls,
      });

      if (baseMarket) {
        logDataSourceEvent('market-details', 'using Envio market details', {
          chainId: network,
          marketUniqueKey: uniqueKey,
        });
      }
    } catch (error) {
      logDataSourceEvent('market-details', 'Envio market details failed, falling back', {
        chainId: network,
        marketUniqueKey: uniqueKey,
        reason: getErrorMessage(error),
      });
    }
  }

  if (!baseMarket && supportsMorphoApi(network)) {
    try {
      baseMarket = await fetchMorphoMarket(uniqueKey, network);

      if (baseMarket) {
        logDataSourceEvent('market-details', 'using Morpho API fallback for market details', {
          chainId: network,
          marketUniqueKey: uniqueKey,
        });
      }
    } catch (error) {
      logDataSourceEvent('market-details', 'Morpho market details failed, falling back to subgraph', {
        chainId: network,
        marketUniqueKey: uniqueKey,
        reason: getErrorMessage(error),
      });
    }
  }

  if (!baseMarket) {
    try {
      baseMarket = await fetchSubgraphMarket(uniqueKey, network);

      if (baseMarket) {
        logDataSourceEvent('market-details', 'using subgraph fallback for market details', {
          chainId: network,
          marketUniqueKey: uniqueKey,
        });
      }
    } catch (error) {
      logDataSourceEvent('market-details', 'subgraph market details failed', {
        chainId: network,
        marketUniqueKey: uniqueKey,
        reason: getErrorMessage(error),
      });
    }
  }

  if (!baseMarket) {
    return null;
  }

  if (isTokenBlacklistedMarket(baseMarket)) {
    logDataSourceEvent('market-details', 'filtered token-blacklisted market from details view', {
      chainId: network,
      marketUniqueKey: uniqueKey,
    });
    return null;
  }

  const [marketWithUsd] = await fillMissingMarketUsdValues([baseMarket]).catch(() => [baseMarket]);
  baseMarket = marketWithUsd ?? baseMarket;

  const [marketWithTargetRate] = await enrichMarketsWithTargetRate([baseMarket], {
    customRpcUrls,
  }).catch(() => [baseMarket]);
  baseMarket = marketWithTargetRate ?? baseMarket;

  if (!enrichHistoricalApys) {
    return baseMarket;
  }

  const [enrichedMarket] = await enrichMarketsWithHistoricalApysWithinTimeout([baseMarket], MARKET_ENRICHMENT_TIMEOUT_MS, customRpcUrls).catch(
    () => [baseMarket],
  );
  return enrichedMarket ?? baseMarket;
};
