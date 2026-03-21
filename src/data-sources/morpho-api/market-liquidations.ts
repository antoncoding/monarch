import { marketLiquidationsQuery } from '@/graphql/morpho-api-queries';
import type { PaginatedMarketLiquidations } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

// Type for the raw Morpho API response structure
type MorphoAPILiquidationItem = {
  hash: string;
  timestamp: number;
  type: string; // Should be 'MarketLiquidation'
  data: {
    repaidAssets: string;
    seizedAssets: string;
    liquidator: string;
    badDebtAssets: string;
  };
};

type MorphoAPILiquidationsResponse = {
  data?: {
    transactions?: {
      items?: MorphoAPILiquidationItem[];
      pageInfo?: {
        countTotal: number;
      };
    };
  };
};

/**
 * Fetches market liquidation activities from the Morpho Blue API.
 * @param marketId The unique key or ID of the market.
 * @returns A promise resolving to paginated unified MarketLiquidationTransaction objects.
 */
export const fetchMorphoMarketLiquidations = async (marketId: string, first = 8, skip = 0): Promise<PaginatedMarketLiquidations> => {
  const variables = {
    uniqueKey: marketId,
    first,
    skip,
  };

  try {
    const result = await morphoGraphqlFetcher<MorphoAPILiquidationsResponse>(marketLiquidationsQuery, variables);

    // Handle NOT_FOUND - return empty array
    if (!result) {
      return { items: [], totalCount: 0 };
    }

    const items = result.data?.transactions?.items ?? [];
    const totalCount = result.data?.transactions?.pageInfo?.countTotal ?? 0;

    // Map to unified type
    return {
      items: items.map((item) => ({
        type: 'MarketLiquidation', // Standardize type
        hash: item.hash,
        timestamp: item.timestamp,
        liquidator: item.data.liquidator,
        repaidAssets: item.data.repaidAssets,
        seizedAssets: item.data.seizedAssets,
        badDebtAssets: item.data.badDebtAssets,
      })),
      totalCount,
    };
  } catch (error) {
    console.error(`Error fetching or processing Morpho API market liquidations for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Morpho API market liquidations');
  }
};
