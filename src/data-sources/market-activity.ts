import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import {
  fetchEnvioMarketBorrows,
  fetchEnvioMarketLiquidations,
  fetchEnvioMarketSupplies,
} from '@/data-sources/envio/market-activity';
import { fetchMorphoMarketBorrows } from '@/data-sources/morpho-api/market-borrows';
import { fetchMorphoMarketLiquidations } from '@/data-sources/morpho-api/market-liquidations';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { fetchSubgraphMarketBorrows } from '@/data-sources/subgraph/market-borrows';
import { fetchSubgraphMarketLiquidations } from '@/data-sources/subgraph/market-liquidations';
import { fetchSubgraphMarketSupplies } from '@/data-sources/subgraph/market-supplies';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketLiquidationTransaction, PaginatedMarketActivityTransactions } from '@/utils/types';

export const fetchMarketSupplies = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
  minAssets = '0',
  pageSize = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketSupplies(marketId, network, minAssets, pageSize, skip);
    } catch (envioError) {
      console.error('Failed to fetch supplies via Envio:', envioError);
    }
  }

  if (supportsMorphoApi(network)) {
    try {
      return await fetchMorphoMarketSupplies(marketId, minAssets, pageSize, skip);
    } catch (morphoError) {
      console.error('Failed to fetch supplies via Morpho API:', morphoError);
    }
  }

  return fetchSubgraphMarketSupplies(marketId, loanAssetId, network, minAssets, pageSize, skip);
};

export const fetchMarketBorrows = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
  minAssets = '0',
  pageSize = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketBorrows(marketId, network, minAssets, pageSize, skip);
    } catch (envioError) {
      console.error('Failed to fetch borrows via Envio:', envioError);
    }
  }

  if (supportsMorphoApi(network)) {
    try {
      return await fetchMorphoMarketBorrows(marketId, minAssets, pageSize, skip);
    } catch (morphoError) {
      console.error('Failed to fetch borrows via Morpho API:', morphoError);
    }
  }

  return fetchSubgraphMarketBorrows(marketId, loanAssetId, network, minAssets, pageSize, skip);
};

export const fetchMarketLiquidations = async (
  marketId: string,
  network: SupportedNetworks,
): Promise<MarketLiquidationTransaction[]> => {
  if (hasEnvioIndexer()) {
    try {
      return await fetchEnvioMarketLiquidations(marketId, network);
    } catch (envioError) {
      console.error('Failed to fetch liquidations via Envio:', envioError);
    }
  }

  if (supportsMorphoApi(network)) {
    try {
      return await fetchMorphoMarketLiquidations(marketId);
    } catch (morphoError) {
      console.error('Failed to fetch liquidations via Morpho API:', morphoError);
    }
  }

  return fetchSubgraphMarketLiquidations(marketId, network);
};
