import { userPositionsQuery, userPositionForMarketQuery } from '@/graphql/morpho-api-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketPosition } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

// Type for the raw response from the Morpho API userPositionsQuery
type MorphoUserPositionsApiResponse = {
  data?: {
    userByAddress?: {
      marketPositions?: MarketPosition[];
    };
  };
  errors?: { message: string }[];
};

// Type for the raw response from the Morpho API userPositionForMarketQuery
type MorphoUserMarketPositionApiResponse = {
  data?: {
    marketPosition?: MarketPosition;
  };
  errors?: { message: string }[];
};

// Type for a valid position with required fields
type ValidMarketPosition = MarketPosition & {
  market: {
    uniqueKey: string;
    morphoBlue: { chain: { id: number } };
  };
};

/**
 * Fetches the unique keys of markets where a user has a position from the Morpho API.
 */
export const fetchMorphoUserPositionMarkets = async (
  userAddress: string,
  network: SupportedNetworks,
): Promise<{ marketUniqueKey: string; chainId: number }[]> => {
  try {
    const result = await morphoGraphqlFetcher<MorphoUserPositionsApiResponse>(userPositionsQuery, {
      address: userAddress.toLowerCase(),
      chainId: network,
    });

    // Handle NOT_FOUND - return empty array
    if (!result) {
      return [];
    }

    const marketPositions = result.data?.userByAddress?.marketPositions ?? [];

    // Filter for valid positions and extract market key and chain ID
    const positionMarkets = marketPositions
      .filter(
        (position): position is ValidMarketPosition =>
          position.market?.uniqueKey !== undefined && position.market?.morphoBlue?.chain?.id !== undefined,
      )
      .map((position) => ({
        marketUniqueKey: position.market.uniqueKey,
        chainId: position.market.morphoBlue.chain.id,
      }));

    return positionMarkets;
  } catch (error) {
    console.error(`Failed to fetch position markets from Morpho API for ${userAddress} on ${network}:`, error);
    throw error; // Re-throw to allow caller to handle fallback
  }
};

/**
 * Fetches a user's position for a specific market directly from the Morpho API.
 */
export const fetchMorphoUserPositionForMarket = async (
  marketUniqueKey: string,
  userAddress: string,
  network: SupportedNetworks,
): Promise<MarketPosition | null> => {
  try {
    const result = await morphoGraphqlFetcher<MorphoUserMarketPositionApiResponse>(userPositionForMarketQuery, {
      address: userAddress.toLowerCase(),
      chainId: network,
      marketKey: marketUniqueKey,
    });

    // Handle NOT_FOUND - return null
    if (!result) {
      return null;
    }

    const marketPosition = result.data?.marketPosition;

    // Check if the position state has zero balances - API might return structure even with no actual position
    if (
      marketPosition &&
      marketPosition.state.supplyAssets === '0' &&
      marketPosition.state.borrowAssets === '0' &&
      marketPosition.state.collateral === '0'
    ) {
      return null; // Treat zero balance position as null
    }

    return marketPosition ?? null;
  } catch (error) {
    console.error(`Failed to fetch position for market ${marketUniqueKey} from Morpho API for ${userAddress} on ${network}:`, error);
    return null; // Return null on error
  }
};
