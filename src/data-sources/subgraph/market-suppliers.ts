import { marketSuppliersQuery } from '@/graphql/morpho-subgraph-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import type { MarketSupplier, PaginatedMarketSuppliers } from '@/utils/types';
import { subgraphGraphqlFetcher } from './fetchers';

// Type for the Subgraph response
type SubgraphSupplierItem = {
  shares: string;
  account: {
    id: string;
  };
};

type SubgraphSuppliersResponse = {
  data?: {
    positions?: SubgraphSupplierItem[];
  };
};

// In-memory cache for subgraph data (avoids refetching 1000 items on page change)
type CacheEntry = {
  data: MarketSupplier[];
  timestamp: number;
};

const suppliersCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (same as React Query staleTime)

function getCacheKey(marketId: string, network: SupportedNetworks, minShares: string): string {
  return `${network}-${marketId}-${minShares}`;
}

/**
 * Fetches current market suppliers (positions) from the Subgraph.
 * Uses adapter pattern: Always fetches top 1000 items and performs client-side pagination.
 * This approach keeps the interface identical to Morpho API while working within subgraph limits.
 *
 * @param marketId The ID of the market (unique key).
 * @param network The blockchain network.
 * @param minShares Minimum share amount to filter suppliers (optional, defaults to '0').
 * @param pageSize Number of items to return per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketSupplier objects.
 */
export const fetchSubgraphMarketSuppliers = async (
  marketId: string,
  network: SupportedNetworks,
  minShares = '0',
  pageSize = 8,
  skip = 0,
): Promise<PaginatedMarketSuppliers> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.warn(`No Subgraph URL configured for network: ${network}. Returning empty results.`);
    return { items: [], totalCount: 0 };
  }

  const cacheKey = getCacheKey(marketId, network, minShares);
  const now = Date.now();

  // Check cache first
  const cached = suppliersCache.get(cacheKey);
  let allMappedItems: MarketSupplier[];

  if (cached && now - cached.timestamp < CACHE_TTL) {
    // Use cached data
    allMappedItems = cached.data;
    console.log(`Using cached suppliers data for ${marketId} (${allMappedItems.length} items)`);
  } else {
    // Fetch fresh data - always fetch top 1000 items (subgraph limit)
    const variables = {
      market: marketId,
      minShares,
      first: 1000,
      skip: 0,
    };

    try {
      const result = await subgraphGraphqlFetcher<SubgraphSuppliersResponse>(subgraphUrl, marketSuppliersQuery, variables);

      const positions = result.data?.positions ?? [];

      // Map all items to unified type
      allMappedItems = positions.map((position) => ({
        userAddress: position.account.id,
        supplyShares: position.shares,
      }));

      // Update cache
      suppliersCache.set(cacheKey, {
        data: allMappedItems,
        timestamp: now,
      });

      console.log(`Fetched and cached ${allMappedItems.length} suppliers for ${marketId}`);
    } catch (error) {
      console.error(`Error fetching or processing Subgraph market suppliers for ${marketId}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while fetching subgraph market suppliers');
    }
  }

  // Perform client-side pagination by slicing the results
  const start = skip;
  const end = skip + pageSize;
  const paginatedItems = allMappedItems.slice(start, end);

  // Return with actual total count (capped at 1000 by subgraph)
  return {
    items: paginatedItems,
    totalCount: allMappedItems.length,
  };
};
