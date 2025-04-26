import { userPositionsQuery } from '@/graphql/morpho-api-queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition } from '@/utils/types';
import { URLS } from '@/utils/urls';

// Type for the raw response from the Morpho API userPositionsQuery
type MorphoUserPositionsApiResponse = {
  data?: {
    userByAddress?: {
      marketPositions?: MarketPosition[];
    };
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
    const response = await fetch(URLS.MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: userPositionsQuery,
        variables: {
          address: userAddress.toLowerCase(),
          chainId: network,
        },
      }),
    });

    const result = (await response.json()) as MorphoUserPositionsApiResponse;

    if (result.errors) {
      console.error(
        `Morpho API error fetching position markets for ${userAddress} on ${network}:`,
        result.errors,
      );
      throw new Error(result.errors.map((e) => e.message).join('; '));
    }

    const marketPositions = result.data?.userByAddress?.marketPositions ?? [];

    // Filter for valid positions and extract market key and chain ID
    const positionMarkets = marketPositions
      .filter(
        (position): position is ValidMarketPosition =>
          position.market?.uniqueKey !== undefined &&
          position.market?.morphoBlue?.chain?.id !== undefined,
      )
      .map((position) => ({
        marketUniqueKey: position.market.uniqueKey,
        chainId: position.market.morphoBlue.chain.id,
      }));

    return positionMarkets;
  } catch (error) {
    console.error(
      `Failed to fetch position markets from Morpho API for ${userAddress} on ${network}:`,
      error,
    );
    return []; // Return empty array on error
  }
};
