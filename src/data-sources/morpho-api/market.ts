import { marketDetailQuery, marketsQuery } from '@/graphql/morpho-api-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { blacklistTokens } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';
import { zeroAddress } from 'viem';

// API response type - matches the new Morpho API shape where oracleAddress is nested
type MorphoApiMarket = Omit<Market, 'oracleAddress' | 'whitelisted'> & {
  oracle: { address: string } | null;
  listed: boolean;
};

type MarketGraphQLResponse = {
  data?: {
    marketByUniqueKey?: MorphoApiMarket;
  };
  errors?: { message: string }[];
};

// Define response type for multiple markets with pageInfo
type MarketsGraphQLResponse = {
  data?: {
    markets?: {
      items?: MorphoApiMarket[];
      pageInfo?: {
        countTotal: number;
        count: number;
        limit: number;
        skip: number;
      };
    };
  };
  errors?: { message: string }[];
};

// Transform API response to internal Market type
const processMarketData = (market: MorphoApiMarket): Market => {
  const { oracle, listed, ...rest } = market;
  return {
    ...rest,
    oracleAddress: oracle?.address ?? zeroAddress,
    whitelisted: listed,
    hasUSDPrice: true,
  };
};

// Fetcher for market details from Morpho API
export const fetchMorphoMarket = async (uniqueKey: string, network: SupportedNetworks): Promise<Market> => {
  const response = await morphoGraphqlFetcher<MarketGraphQLResponse>(marketDetailQuery, {
    uniqueKey,
    chainId: network,
  });
  if (!response || !response.data || !response.data.marketByUniqueKey) {
    throw new Error('Market data not found in Morpho API response');
  }
  return processMarketData(response.data.marketByUniqueKey);
};

// Fetcher for multiple markets from Morpho API with pagination
// Uses whitelisted filter to avoid corrupted/junk market records that cause API errors
export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  const allMarkets: Market[] = [];
  let skip = 0;
  const pageSize = 500;
  let totalCount = 0;
  let queryCount = 0;

  try {
    do {
      queryCount++;

      const variables = {
        first: pageSize,
        skip,
        where: {
          chainId_in: [network],
          // Filter for whitelisted markets only - this avoids corrupted/orphaned market
          // records in the Morpho API that cause "cannot find market config" errors.
          // Non-whitelisted markets for user positions are fetched individually on demand.
          whitelisted: true,
        },
      };

      const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(marketsQuery, variables);

      if (!response?.data?.markets?.items || !response.data.markets.pageInfo) {
        console.warn(`[Markets] No data in response for network ${network} at skip ${skip}`);
        break;
      }

      const { items, pageInfo } = response.data.markets;

      const processedMarkets = items.map(processMarketData);
      allMarkets.push(...processedMarkets);

      totalCount = pageInfo.countTotal;
      skip += pageInfo.count;

      console.log(`[Markets] Query ${queryCount}: Fetched ${pageInfo.count} markets, total: ${allMarkets.length}/${totalCount}`);

      if (pageInfo.count === 0) break;
    } while (skip < totalCount);

    console.log(`[Markets] Completed for network ${network}. Queries: ${queryCount}, Markets: ${allMarkets.length}`);

    // Final filter: remove scam markets
    return allMarkets.filter(
      (market) =>
        !blacklistTokens.includes(market.collateralAsset?.address.toLowerCase() ?? '') &&
        !blacklistTokens.includes(market.loanAsset?.address.toLowerCase() ?? ''),
    );
  } catch (error) {
    console.error(`[Markets] Error fetching markets for network ${network}:`, error);
    throw error;
  }
};
