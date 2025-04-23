import { marketBorrowsQuery } from '@/graphql/morpho-api-queries';
// Import the shared type from its new location
import { MarketActivityTransaction } from '@/utils/types';
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
    };
  };
};

/**
 * Fetches market borrow/repay activities from the Morpho Blue API.
 * Uses the shared Morpho API fetcher.
 * @param marketId The unique key or ID of the market.
 * @returns A promise resolving to an array of unified MarketActivityTransaction objects.
 */
export const fetchMorphoMarketBorrows = async (
  marketId: string,
): Promise<MarketActivityTransaction[]> => {
  const variables = {
    uniqueKey: marketId,
    first: 1000,
    skip: 0,
  };

  try {
    const result = await morphoGraphqlFetcher<MorphoAPIBorrowsResponse>(
      marketBorrowsQuery,
      variables,
    );

    const items = result.data?.transactions?.items ?? [];

    // Map to unified type (reusing MarketActivityTransaction)
    return items.map((item) => ({
      type: item.type, // Directly use 'MarketBorrow' or 'MarketRepay'
      hash: item.hash,
      timestamp: item.timestamp,
      amount: item.data.assets, // Map 'assets' to 'amount'
      userAddress: item.user.address,
    }));
  } catch (error) {
    console.error(`Error fetching or processing Morpho API market borrows for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Morpho API market borrows');
  }
};
