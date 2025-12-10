import { marketPositionsQuery } from '@/graphql/morpho-subgraph-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import type { PaginatedMarketSuppliers } from '@/utils/types';
import { subgraphGraphqlFetcher } from './fetchers';

// Type for the Subgraph response
type SubgraphPositionItem = {
  shares: string;
  account: {
    id: string;
  };
};

type SubgraphPositionsResponse = {
  data?: {
    positions?: SubgraphPositionItem[];
  };
};

/**
 * Fetches current market suppliers (positions) from the Subgraph.
 * @param marketId The ID of the market (unique key).
 * @param network The blockchain network.
 * @param minShares Minimum share amount to filter suppliers (optional, defaults to '0').
 * @param first Number of items to return per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketSupplier objects.
 */
export const fetchSubgraphMarketSuppliers = async (
  marketId: string,
  network: SupportedNetworks,
  minShares = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketSuppliers> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.warn(`No Subgraph URL configured for network: ${network}. Returning empty results.`);
    return { items: [], totalCount: 0 };
  }

  const variables = {
    market: marketId,
    minShares,
    first,
    skip,
  };

  try {
    const result = await subgraphGraphqlFetcher<SubgraphPositionsResponse>(subgraphUrl, marketPositionsQuery, variables);

    const positions = result.data?.positions ?? [];

    // Map to unified type
    const mappedItems = positions.map((position) => ({
      userAddress: position.account.id,
      supplyShares: position.shares,
    }));

    // Note: Subgraph doesn't provide total count, so we use the length of items
    // For proper pagination, we'd need a separate count query
    return {
      items: mappedItems,
      totalCount: mappedItems.length,
    };
  } catch (error) {
    console.error(`Error fetching or processing Subgraph market suppliers for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market suppliers');
  }
};
