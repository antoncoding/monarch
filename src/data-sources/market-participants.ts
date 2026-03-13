import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarketBorrowers, fetchEnvioMarketSuppliers } from '@/data-sources/envio/market-participants';
import { fetchMorphoMarketBorrowers } from '@/data-sources/morpho-api/market-borrowers';
import { fetchMorphoMarketSuppliers } from '@/data-sources/morpho-api/market-suppliers';
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
    } catch (envioError) {
      console.error('Failed to fetch borrowers via Envio:', envioError);
    }
  }

  if (supportsMorphoApi(network)) {
    try {
      return await fetchMorphoMarketBorrowers(marketId, Number(network), minShares, pageSize, skip);
    } catch (morphoError) {
      console.error('Failed to fetch borrowers via Morpho API:', morphoError);
    }
  }

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
    } catch (envioError) {
      console.error('Failed to fetch suppliers via Envio:', envioError);
    }
  }

  if (supportsMorphoApi(network)) {
    try {
      return await fetchMorphoMarketSuppliers(marketId, Number(network), minShares, pageSize, skip);
    } catch (morphoError) {
      console.error('Failed to fetch suppliers via Morpho API:', morphoError);
    }
  }

  return fetchSubgraphMarketSuppliers(marketId, network, minShares, pageSize, skip);
};
