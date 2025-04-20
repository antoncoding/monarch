import { marketDetailQuery } from '@/graphql/morpho-api-queries';
import { SupportedNetworks } from '@/utils/networks';
import { Market } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { morphoGraphqlFetcher } from './fetchers';

type MarketGraphQLResponse = {
  data: {
    marketByUniqueKey: Market;
  };
  errors?: { message: string }[];
};

const processMarketData = (market: Market): Market => {
  const warningsWithDetail = getMarketWarningsWithDetail(market);
  return {
    ...market,
    warningsWithDetail,
    isProtectedByLiquidationBots: false,
  };
};

// Fetcher for market details from Morpho API
export const fetchMorphoMarket = async (
  uniqueKey: string,
  network: SupportedNetworks,
): Promise<Market> => {
  const response = await morphoGraphqlFetcher<MarketGraphQLResponse>(marketDetailQuery, {
    uniqueKey,
    chainId: network,
  });
  if (!response.data || !response.data.marketByUniqueKey) {
    throw new Error('Market data not found in Morpho API response');
  }
  return processMarketData(response.data.marketByUniqueKey);
};
