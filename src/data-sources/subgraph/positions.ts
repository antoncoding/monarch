import { subgraphUserPositionMarketsQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';

type SubgraphPositionMarketResponse = {
  data?: {
    account?: {
      positions?: {
        market: {
          id: string;
        };
      }[];
    };
  };
  errors?: { message: string }[];
};

/**
 * Fetches the unique keys of markets where a user has a position from the Subgraph.
 */
export const fetchSubgraphUserPositionMarkets = async (
  userAddress: string,
  network: SupportedNetworks,
): Promise<{ marketUniqueKey: string; chainId: number }[]> => {
  const endpoint = getSubgraphUrl(network);
  if (!endpoint) {
    console.warn(`No subgraph endpoint found for network ${network}`);
    return [];
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: subgraphUserPositionMarketsQuery,
        variables: {
          userId: userAddress.toLowerCase(),
        },
      }),
    });

    const result = (await response.json()) as SubgraphPositionMarketResponse;

    if (result.errors) {
      console.error(
        `Subgraph error fetching position markets for ${userAddress} on ${network}:`,
        result.errors,
      );
      throw new Error(result.errors.map((e) => e.message).join('; '));
    }

    const positions = result.data?.account?.positions ?? [];

    return positions.map((pos) => ({
      marketUniqueKey: pos.market.id,
      chainId: network, // The network ID is passed in
    }));
  } catch (error) {
    console.error(
      `Failed to fetch position markets from subgraph for ${userAddress} on ${network}:`,
      error,
    );
    return []; // Return empty array on error
  }
};
