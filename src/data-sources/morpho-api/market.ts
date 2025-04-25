import { marketDetailQuery, marketsQuery } from '@/graphql/morpho-api-queries';
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

// Define response type for multiple markets
type MarketsGraphQLResponse = {
  data: {
    markets: {
      items: Market[];
    };
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

// Fetcher for multiple markets from Morpho API
export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  // Construct the full variables object including the where clause
  const variables = {
    first: 1000, // Max limit
    where: {
      chainId_in: [network],
      whitelisted: true,
      // Add other potential filters to 'where' if needed in the future
    },
  };

  const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(marketsQuery, variables);

  if (!response.data || !response.data.markets || !response.data.markets.items) {
    console.warn(`Market data not found in Morpho API response for network ${network}.`);
    return []; // Return empty array if not found
  }

  // Process each market in the items array
  return response.data.markets.items.map(processMarketData);
};
