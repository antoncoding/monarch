import { marketBorrowersQuery } from '@/graphql/morpho-api-queries';
import type { PaginatedMarketBorrowers } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

// Type specifically for the raw Morpho API response structure within this module
type MorphoAPIBorrowersResponse = {
  data?: {
    marketPositions?: {
      items?: {
        state: {
          borrowAssets: string;
          collateral: string;
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
 * Fetches current market borrowers (positions) from the Morpho Blue API.
 * Returns borrowers sorted by borrow shares (descending).
 * Uses the shared Morpho API fetcher.
 * @param marketId The unique key or ID of the market.
 * @param chainId The chain ID where the market exists.
 * @param minShares Minimum borrow share amount to filter borrowers (optional, defaults to '0').
 * @param first Number of items to fetch per page (optional, defaults to 10).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketBorrower objects.
 */
export const fetchMorphoMarketBorrowers = async (
  marketId: string,
  chainId: number,
  minShares = '0',
  first = 10,
  skip = 0,
): Promise<PaginatedMarketBorrowers> => {
  const variables = {
    uniqueKey: marketId,
    chainId,
    minShares,
    first,
    skip,
  };

  try {
    // Use the shared fetcher
    const result = await morphoGraphqlFetcher<MorphoAPIBorrowersResponse>(marketBorrowersQuery, variables);

    // Handle NOT_FOUND - return empty result
    if (!result) {
      return { items: [], totalCount: 0 };
    }

    // Fetcher handles network and basic GraphQL errors
    const items = result.data?.marketPositions?.items ?? [];
    const totalCount = result.data?.marketPositions?.pageInfo?.countTotal ?? 0;

    // Map to unified type
    const mappedItems = items.map((item) => ({
      userAddress: item.user.address,
      borrowAssets: item.state.borrowAssets,
      collateral: item.state.collateral,
    }));

    return {
      items: mappedItems,
      totalCount,
    };
  } catch (error) {
    // Catch errors from the fetcher or during processing
    console.error(`Error fetching or processing Morpho API market borrowers for ${marketId}:`, error);
    // Re-throw the error to be handled by the calling hook
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Morpho API market borrowers');
  }
};
