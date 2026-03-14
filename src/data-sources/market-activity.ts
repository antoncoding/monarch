import { hasEnvioIndexer } from '@/config/dataSources';
import {
  fetchEnvioMarketBorrows,
  fetchEnvioMarketLiquidations,
  fetchEnvioMarketSupplies,
} from '@/data-sources/envio/market-activity';
import { fetchMorphoMarketBorrows } from '@/data-sources/morpho-api/market-borrows';
import { fetchMorphoMarketLiquidations } from '@/data-sources/morpho-api/market-liquidations';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketLiquidationTransaction, PaginatedMarketActivityTransactions } from '@/utils/types';

export const fetchMarketSupplies = async (
  marketId: string,
  network: SupportedNetworks,
  minAssets = '0',
  pageSize = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketSupplies(marketId, network, minAssets, pageSize, skip);
    } catch (error) {
      logDataSourceEvent('market-supplies', 'Envio supplies fetch failed, falling back', {
        chainId: network,
        marketUniqueKey: marketId,
        reason: getErrorMessage(error),
      });
    }
  }

  try {
    return await fetchMorphoMarketSupplies(marketId, network, minAssets, pageSize, skip);
  } catch (error) {
    logDataSourceEvent('market-supplies', 'Morpho API supplies fetch failed', {
      chainId: network,
      marketUniqueKey: marketId,
      reason: getErrorMessage(error),
    });
  }

  return {
    items: [],
    totalCount: 0,
  };
};

export const fetchMarketBorrows = async (
  marketId: string,
  network: SupportedNetworks,
  minAssets = '0',
  pageSize = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketBorrows(marketId, network, minAssets, pageSize, skip);
    } catch (error) {
      logDataSourceEvent('market-borrows', 'Envio borrows fetch failed, falling back', {
        chainId: network,
        marketUniqueKey: marketId,
        reason: getErrorMessage(error),
      });
    }
  }

  try {
    return await fetchMorphoMarketBorrows(marketId, network, minAssets, pageSize, skip);
  } catch (error) {
    logDataSourceEvent('market-borrows', 'Morpho API borrows fetch failed', {
      chainId: network,
      marketUniqueKey: marketId,
      reason: getErrorMessage(error),
    });
  }

  return {
    items: [],
    totalCount: 0,
  };
};

export const fetchMarketLiquidations = async (
  marketId: string,
  network: SupportedNetworks,
): Promise<MarketLiquidationTransaction[]> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketLiquidations(marketId, network);
    } catch (error) {
      logDataSourceEvent('market-liquidations', 'Envio liquidations fetch failed, falling back', {
        chainId: network,
        marketUniqueKey: marketId,
        reason: getErrorMessage(error),
      });
    }
  }

  try {
    return await fetchMorphoMarketLiquidations(marketId, network);
  } catch (error) {
    logDataSourceEvent('market-liquidations', 'Morpho API liquidations fetch failed', {
      chainId: network,
      marketUniqueKey: marketId,
      reason: getErrorMessage(error),
    });
  }

  return [];
};
