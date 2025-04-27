import { marketLiquidationsQuery } from '@/graphql/morpho-api-queries';
import { MarketLiquidationTransaction } from '@/utils/types'; // Import unified type
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
    };
  };
};

/**
 * Fetches market liquidation activities from the Morpho Blue API.
 * @param marketId The unique key or ID of the market.
 * @returns A promise resolving to an array of unified MarketLiquidationTransaction objects.
 */
export const fetchMorphoMarketLiquidations = async (
  marketId: string,
): Promise<MarketLiquidationTransaction[]> => {
  const variables = {
    uniqueKey: marketId,
    // Morpho API query might not need first/skip for liquidations, adjust if needed
  };

  try {
    const result = await morphoGraphqlFetcher<MorphoAPILiquidationsResponse>(
      marketLiquidationsQuery,
      variables,
    );

    const items = result.data?.transactions?.items ?? [];

    // Map to unified type
    return items.map((item) => ({
      type: 'MarketLiquidation', // Standardize type
      hash: item.hash,
      timestamp: item.timestamp,
      liquidator: item.data.liquidator,
      repaidAssets: item.data.repaidAssets,
      seizedAssets: item.data.seizedAssets,
      badDebtAssets: item.data.badDebtAssets,
      // Removed optional fields not present in the simplified type
    }));
  } catch (error) {
    console.error(
      `Error fetching or processing Morpho API market liquidations for ${marketId}:`,
      error,
    );
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Morpho API market liquidations');
  }
};
