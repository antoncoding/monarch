import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarketBorrowers, fetchEnvioMarketSuppliers } from '@/data-sources/envio/market-participants';
import { fetchMorphoMarketBorrowers } from '@/data-sources/morpho-api/market-borrowers';
import { fetchMorphoMarketSuppliers } from '@/data-sources/morpho-api/market-suppliers';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
import { fetchSubgraphMarketBorrowers } from '@/data-sources/subgraph/market-borrowers';
import { fetchSubgraphMarketSuppliers } from '@/data-sources/subgraph/market-suppliers';
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

  if (supportsMorphoApi(network)) {
    try {
      return await fetchMorphoMarketBorrowers(marketId, Number(network), minShares, pageSize, skip);
    } catch (error) {
      logDataSourceEvent('market-borrowers', 'Morpho API borrowers fetch failed, falling back to subgraph', {
        chainId: network,
        marketUniqueKey: marketId,
        reason: getErrorMessage(error),
      });
    }
  }

  logDataSourceEvent('market-borrowers', 'using subgraph fallback for borrowers', {
    chainId: network,
    marketUniqueKey: marketId,
  });
  return fetchSubgraphMarketBorrowers(marketId, network, minShares, pageSize, skip);
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

  if (supportsMorphoApi(network)) {
    try {
      return await fetchMorphoMarketSuppliers(marketId, Number(network), minShares, pageSize, skip);
    } catch (error) {
      logDataSourceEvent('market-suppliers', 'Morpho API suppliers fetch failed, falling back to subgraph', {
        chainId: network,
        marketUniqueKey: marketId,
        reason: getErrorMessage(error),
      });
    }
  }

  logDataSourceEvent('market-suppliers', 'using subgraph fallback for suppliers', {
    chainId: network,
    marketUniqueKey: marketId,
  });
  return fetchSubgraphMarketSuppliers(marketId, network, minShares, pageSize, skip);
};
