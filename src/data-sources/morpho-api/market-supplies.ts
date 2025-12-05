import { marketSuppliesQuery } from '@/graphql/morpho-api-queries';
import { MarketActivityTransaction, PaginatedMarketActivityTransactions } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers'; // Import shared fetcher

// Type specifically for the raw Morpho API response structure within this module
type MorphoAPISuppliesResponse = {
  data?: {
    // Mark data as optional to align with fetcher's generic handling
    transactions?: {
      items?: {
        type: 'MarketSupply' | 'MarketWithdraw';
        hash: string;
        timestamp: number;
        data: {
          assets: string;
          shares: string;
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
  // Error handling is now done by the fetcher
};

/**
 * Fetches market supply/withdraw activities from the Morpho Blue API.
 * Uses the shared Morpho API fetcher.
 * @param marketId The unique key or ID of the market.
 * @param minAssets Minimum asset amount to filter transactions (optional, defaults to 0).
 * @param first Number of items to fetch per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketActivityTransaction objects.
 */
export const fetchMorphoMarketSupplies = async (
  marketId: string,
  minAssets: string = '0',
  first: number = 8,
  skip: number = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const variables = {
    uniqueKey: marketId, // Ensure this matches the variable name in the query
    minAssets,
    first,
    skip,
  };

  try {
    // Use the shared fetcher
    const result = await morphoGraphqlFetcher<MorphoAPISuppliesResponse>(
      marketSuppliesQuery,
      variables,
    );

    // Fetcher handles network and basic GraphQL errors
    const items = result.data?.transactions?.items ?? [];
    const totalCount = result.data?.transactions?.pageInfo?.countTotal ?? 0;

    // Map to unified type
    const mappedItems = items.map((item) => ({
      type: item.type,
      hash: item.hash,
      timestamp: item.timestamp,
      amount: item.data.assets,
      userAddress: item.user.address,
      // Note: 'shares' from Morpho API is omitted in the unified type
    }));

    return {
      items: mappedItems,
      totalCount,
    };
  } catch (error) {
    // Catch errors from the fetcher or during processing
    console.error(
      `Error fetching or processing Morpho API market supplies for ${marketId}:`,
      error,
    );
    // Re-throw the error to be handled by the calling hook
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Morpho API market supplies');
  }
};
