import { marketSuppliersQuery } from '@/graphql/morpho-api-queries';
import type { PaginatedMarketSuppliers } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

// Type specifically for the raw Morpho API response structure within this module
type MorphoAPISuppliersResponse = {
  data?: {
    marketPositions?: {
      items?: {
        state: {
          supplyShares: string;
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
 * Fetches current market suppliers (positions) from the Morpho Blue API.
 * Returns suppliers sorted by supply shares (descending).
 * Uses the shared Morpho API fetcher.
 * @param marketId The unique key or ID of the market.
 * @param chainId The chain ID where the market exists.
 * @param minShares Minimum share amount to filter suppliers (optional, defaults to '0').
 * @param first Number of items to fetch per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketSupplier objects.
 */
export const fetchMorphoMarketSuppliers = async (
  marketId: string,
  chainId: number,
  minShares = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketSuppliers> => {
  const variables = {
    uniqueKey: marketId,
    chainId,
    minShares,
    first,
    skip,
  };

  try {
    // Use the shared fetcher
    const result = await morphoGraphqlFetcher<MorphoAPISuppliersResponse>(marketSuppliersQuery, variables);

    // Fetcher handles network and basic GraphQL errors
    const items = result.data?.marketPositions?.items ?? [];
    const totalCount = result.data?.marketPositions?.pageInfo?.countTotal ?? 0;

    // Map to unified type
    const mappedItems = items.map((item) => ({
      userAddress: item.user.address,
      supplyShares: item.state.supplyShares,
    }));

    return {
      items: mappedItems,
      totalCount,
    };
  } catch (error) {
    // Catch errors from the fetcher or during processing
    console.error(`Error fetching or processing Morpho API market suppliers for ${marketId}:`, error);
    // Re-throw the error to be handled by the calling hook
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Morpho API market suppliers');
  }
};
