import { hasEnvioIndexer } from '@/config/dataSources';
import { fetchEnvioMarketBorrowers, fetchEnvioMarketSuppliers } from '@/data-sources/envio/market-participants';
import { fetchMorphoMarketBorrowers } from '@/data-sources/morpho-api/market-borrowers';
import { fetchMorphoMarketSuppliers } from '@/data-sources/morpho-api/market-suppliers';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import type { SupportedNetworks } from '@/utils/networks';
import type { PaginatedMarketBorrowers, PaginatedMarketSuppliers } from '@/utils/types';

export const fetchMarketBorrowers = async (
  marketId: string,
  network: SupportedNetworks,
  minShares = '1',
  pageSize = 10,
  skip = 0,
): Promise<PaginatedMarketBorrowers> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketBorrowers(marketId, network, minShares, pageSize, skip);
    } catch (error) {
      logDataSourceEvent('market-borrowers', 'Envio borrowers fetch failed, falling back', {
        chainId: network,
        marketUniqueKey: marketId,
        reason: getErrorMessage(error),
      });
    }
  }

  try {
    return await fetchMorphoMarketBorrowers(marketId, Number(network), minShares, pageSize, skip);
  } catch (error) {
    logDataSourceEvent('market-borrowers', 'Morpho API borrowers fetch failed', {
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

export const fetchMarketSuppliers = async (
  marketId: string,
  network: SupportedNetworks,
  minShares = '1',
  pageSize = 8,
  skip = 0,
): Promise<PaginatedMarketSuppliers> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketSuppliers(marketId, network, minShares, pageSize, skip);
    } catch (error) {
      logDataSourceEvent('market-suppliers', 'Envio suppliers fetch failed, falling back', {
        chainId: network,
        marketUniqueKey: marketId,
        reason: getErrorMessage(error),
      });
    }
  }

  try {
    return await fetchMorphoMarketSuppliers(marketId, Number(network), minShares, pageSize, skip);
  } catch (error) {
    logDataSourceEvent('market-suppliers', 'Morpho API suppliers fetch failed', {
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
