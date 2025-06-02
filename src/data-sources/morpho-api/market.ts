import { marketDetailQuery, marketsQuery } from '@/graphql/morpho-api-queries';
import { SupportedNetworks } from '@/utils/networks';
import { blacklistTokens } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { morphoGraphqlFetcher } from './fetchers';

type MarketGraphQLResponse = {
  data: {
    marketByUniqueKey: Market;
  };
  errors?: { message: string }[];
};

// Define response type for multiple markets with pageInfo
type MarketsGraphQLResponse = {
  data: {
    markets: {
      items: Market[];
      pageInfo: {
        countTotal: number;
        count: number;
        limit: number;
        skip: number;
      };
    };
  };
  errors?: { message: string }[];
};

const processMarketData = (market: Market): Market => {
  const warningsWithDetail = getMarketWarningsWithDetail(market, true);
  return {
    ...market,
    warningsWithDetail,
    isProtectedByLiquidationBots: false,
    isMonarchWhitelisted: false,

    // Standard API always have USD price!
    hasUSDPrice: true,
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

// Fetcher for multiple markets from Morpho API with pagination
export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  const allMarkets: Market[] = [];
  let skip = 0;
  const pageSize = 1000;
  let totalCount = 0;
  let queryCount = 0;

  try {
    do {
      queryCount++;
      console.log(`Fetching markets query ${queryCount}, skip: ${skip}, pageSize: ${pageSize}`);

      // Construct the variables object including the where clause and pagination
      const variables = {
        first: pageSize,
        skip,
        where: {
          chainId_in: [network],

          // Remove whitelisted filter to fetch all markets
          // Add other potential filters to 'where' if needed in the future
        },
      };

      const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(marketsQuery, variables);

      if (!response.data || !response.data.markets) {
        console.warn(
          `Market data not found in Morpho API response for network ${network} at skip ${skip}.`,
        );
        break;
      }

      const { items, pageInfo } = response.data.markets;

      if (!items || !Array.isArray(items)) {
        console.warn(`No market items found in response for network ${network} at skip ${skip}.`);
        break;
      }

      // Process and add markets to the collection
      const processedMarkets = items.map(processMarketData);
      allMarkets.push(...processedMarkets);

      // Update pagination info
      totalCount = pageInfo.countTotal;
      skip += pageInfo.count;

      console.log(
        `Query ${queryCount}: Fetched ${pageInfo.count} markets, total so far: ${allMarkets.length}/${totalCount}`,
      );

      // Safety break if pageInfo.count is 0 to prevent infinite loop
      if (pageInfo.count === 0 && skip < totalCount) {
        console.warn('Received 0 items in a page, but not yet at total count. Breaking loop.');
        break;
      }
    } while (skip < totalCount);

    console.log(
      `Completed fetching all markets for network ${network}. Total queries: ${queryCount}, Total markets: ${allMarkets.length}`,
    );

    // final filter: remove scam markets
    return allMarkets.filter(
      (market) =>
        !blacklistTokens.includes(market.collateralAsset?.address.toLowerCase() ?? '') &&
        !blacklistTokens.includes(market.loanAsset?.address.toLowerCase() ?? ''),
    );
  } catch (error) {
    console.error(`Error fetching markets via Morpho API for network ${network}:`, error);
    throw error;
  }
};
