import { marketSuppliesQuery } from '@/graphql/morpho-api-queries';
import { MarketActivityTransaction } from '@/utils/types';
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
    };
  };
  // Error handling is now done by the fetcher
};

/**
 * Fetches market supply/withdraw activities from the Morpho Blue API.
 * Uses the shared Morpho API fetcher.
 * @param marketId The unique key or ID of the market.
 * @returns A promise resolving to an array of unified MarketActivityTransaction objects.
 */
export const fetchMorphoMarketSupplies = async (
  marketId: string,
): Promise<MarketActivityTransaction[]> => {
  const variables = {
    uniqueKey: marketId, // Ensure this matches the variable name in the query
    first: 1000,
    skip: 0,
  };

  try {
    // Use the shared fetcher
    const result = await morphoGraphqlFetcher<MorphoAPISuppliesResponse>(
      marketSuppliesQuery,
      variables,
    );

    // Fetcher handles network and basic GraphQL errors
    const items = result.data?.transactions?.items ?? [];

    // Map to unified type
    return items.map((item) => ({
      type: item.type,
      hash: item.hash,
      timestamp: item.timestamp,
      amount: item.data.assets,
      userAddress: item.user.address,
      // Note: 'shares' from Morpho API is omitted in the unified type
    }));
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
