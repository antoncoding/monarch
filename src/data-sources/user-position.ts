import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioUserPositionForMarket } from '@/data-sources/envio/positions';
import { fetchMarketDetails } from '@/data-sources/market-details';
import { fetchMorphoUserPositionForMarket } from '@/data-sources/morpho-api/positions';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import { fetchSubgraphUserPositionForMarket } from '@/data-sources/subgraph/positions';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketPosition } from '@/utils/types';

const hydratePositionMarket = async (
  position: MarketPosition,
  chainId: SupportedNetworks,
  options: {
    customRpcUrls?: CustomRpcUrls;
  },
): Promise<MarketPosition> => {
  const hydratedMarket = await fetchMarketDetails(position.market.uniqueKey, chainId, {
    customRpcUrls: options.customRpcUrls,
    enrichHistoricalApys: false,
  }).catch(() => null);

  if (!hydratedMarket) {
    return position;
  }

  return {
    ...position,
    market: hydratedMarket,
  };
};

export const fetchUserPositionForMarket = async (
  marketUniqueKey: string,
  userAddress: string,
  chainId: SupportedNetworks,
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<MarketPosition | null> => {
  if (hasEnvioIndexer()) {
    try {
      const envioPosition = await fetchEnvioUserPositionForMarket(marketUniqueKey, userAddress, chainId, options);

      if (envioPosition) {
        logDataSourceEvent('user-position', 'using Envio position source', {
          chainId,
          marketUniqueKey,
        });
        return hydratePositionMarket(envioPosition, chainId, options);
      }
    } catch (error) {
      logDataSourceEvent('user-position', 'Envio position fetch failed, falling back', {
        chainId,
        marketUniqueKey,
        reason: getErrorMessage(error),
      });
    }
  }

  if (supportsMorphoApi(chainId)) {
    try {
      const morphoPosition = await fetchMorphoUserPositionForMarket(marketUniqueKey, userAddress, chainId);

      if (morphoPosition) {
        logDataSourceEvent('user-position', 'using Morpho API fallback for position', {
          chainId,
          marketUniqueKey,
        });
        return hydratePositionMarket(morphoPosition, chainId, options);
      }
    } catch (error) {
      logDataSourceEvent('user-position', 'Morpho API position fetch failed, falling back to subgraph', {
        chainId,
        marketUniqueKey,
        reason: getErrorMessage(error),
      });
    }
  }

  logDataSourceEvent('user-position', 'using subgraph fallback for position', {
    chainId,
    marketUniqueKey,
  });
  const subgraphPosition = await fetchSubgraphUserPositionForMarket(marketUniqueKey, userAddress, chainId);

  if (!subgraphPosition) {
    return null;
  }

  return hydratePositionMarket(subgraphPosition, chainId, options);
};
