import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioUserPositionForMarket } from '@/data-sources/envio/positions';
import { fetchMarketDetails } from '@/data-sources/market-details';
import { fetchMorphoUserPositionForMarket } from '@/data-sources/morpho-api/positions';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import { fetchSubgraphUserPositionForMarket } from '@/data-sources/subgraph/positions';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
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

const isMatchingPosition = (position: MarketPosition, marketUniqueKey: string, chainId: SupportedNetworks): boolean => {
  const positionMarketKey = position.market?.uniqueKey;
  const positionChainId = position.market?.morphoBlue?.chain?.id;

  if (!positionMarketKey || positionChainId == null) {
    return false;
  }

  return getChainScopedMarketKey(positionMarketKey, positionChainId) === getChainScopedMarketKey(marketUniqueKey, chainId);
};

const getValidatedPosition = ({
  chainId,
  marketUniqueKey,
  position,
  source,
}: {
  chainId: SupportedNetworks;
  marketUniqueKey: string;
  position: MarketPosition | null;
  source: string;
}): MarketPosition | null => {
  if (!position) {
    return null;
  }

  if (isMatchingPosition(position, marketUniqueKey, chainId)) {
    return position;
  }

  logDataSourceEvent('user-position', `discarded mismatched ${source} position payload`, {
    chainId,
    marketUniqueKey,
  });
  return null;
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
      const envioPosition = getValidatedPosition({
        chainId,
        marketUniqueKey,
        position: await fetchEnvioUserPositionForMarket(marketUniqueKey, userAddress, chainId, options),
        source: 'Envio',
      });

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
      const morphoPosition = getValidatedPosition({
        chainId,
        marketUniqueKey,
        position: await fetchMorphoUserPositionForMarket(marketUniqueKey, userAddress, chainId),
        source: 'Morpho API',
      });

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
  let subgraphPosition: MarketPosition | null = null;

  try {
    subgraphPosition = await fetchSubgraphUserPositionForMarket(marketUniqueKey, userAddress, chainId);
  } catch (error) {
    logDataSourceEvent('user-position', 'subgraph position fallback failed', {
      chainId,
      marketUniqueKey,
      reason: getErrorMessage(error),
    });
    return null;
  }

  if (!subgraphPosition || !isMatchingPosition(subgraphPosition, marketUniqueKey, chainId)) {
    return null;
  }

  return hydratePositionMarket(subgraphPosition, chainId, options);
};
