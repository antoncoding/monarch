import { marketBorrowsQuery } from '@/graphql/morpho-api-queries';
// Import the shared type from its new location
import type { PaginatedMarketActivityTransactions } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

// Type specifically for the raw Morpho API response structure for borrows/repays
type MorphoAPIBorrowsResponse = {
  data?: {
    transactions?: {
      items?: {
        type: 'MarketBorrow' | 'MarketRepay'; // Specific types for this query
        hash: string;
        timestamp: number;
        data: {
          assets: string;
          shares: string; // Present but ignored in unified type
        };
        user: {
          address: string;
        };
      }[];
      pageInfo?: {
        countTotal: number;
        count: number;
        limit: number;
        skip: number;
      };
    };
  };
};

/**
 * Fetches market borrow/repay activities from the Morpho Blue API.
 * Uses the shared Morpho API fetcher.
 * @param marketId The unique key or ID of the market.
 * @param minAssets Minimum asset amount to filter transactions (optional, defaults to 0).
 * @param first Number of items to fetch per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketActivityTransaction objects.
 */
export const fetchMorphoMarketBorrows = async (
  marketId: string,
  minAssets = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const variables = {
    uniqueKey: marketId,
    minAssets,
    first,
    skip,
  };

  try {
    const result = await morphoGraphqlFetcher<MorphoAPIBorrowsResponse>(marketBorrowsQuery, variables);

    const items = result.data?.transactions?.items ?? [];
    const totalCount = result.data?.transactions?.pageInfo?.countTotal ?? 0;

    // Map to unified type (reusing MarketActivityTransaction)
    const mappedItems = items.map((item) => ({
      type: item.type, // Directly use 'MarketBorrow' or 'MarketRepay'
      hash: item.hash,
      timestamp: item.timestamp,
      amount: item.data.assets, // Map 'assets' to 'amount'
      userAddress: item.user.address,
    }));

    return {
      items: mappedItems,
      totalCount,
    };
  } catch (error) {
    console.error(`Error fetching or processing Morpho API market borrows for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Morpho API market borrows');
  }
};
