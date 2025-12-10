import { marketBorrowersQuery } from '@/graphql/morpho-subgraph-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import type { MarketBorrower, PaginatedMarketBorrowers } from '@/utils/types';
import { subgraphGraphqlFetcher } from './fetchers';

// Type for the Subgraph response
type SubgraphBorrowerItem = {
  shares: string;
  account: {
    id: string;
    positions: {
      balance: string;
    }[];
  };
};

type SubgraphBorrowersResponse = {
  data?: {
    market?: {
      totalBorrow: string;
      totalBorrowShares: string;
    };
    positions?: SubgraphBorrowerItem[];
  };
};

// In-memory cache for subgraph data (avoids refetching 1000 items on page change)
type CacheEntry = {
  data: MarketBorrower[];
  timestamp: number;
};

const borrowersCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (same as React Query staleTime)

function getCacheKey(marketId: string, network: SupportedNetworks, minShares: string): string {
  return `${network}-${marketId}-${minShares}`;
}

/**
 * Fetches current market borrowers (positions) from the Subgraph.
 * Uses adapter pattern: Always fetches top 1000 items and performs client-side pagination.
 * Returns borrowers with their collateral balances.
 * This approach keeps the interface identical to Morpho API while working within subgraph limits.
 *
 * @param marketId The ID of the market (unique key).
 * @param network The blockchain network.
 * @param minShares Minimum borrow share amount to filter borrowers (optional, defaults to '0').
 * @param pageSize Number of items to return per page (optional, defaults to 10).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketBorrower objects.
 */
export const fetchSubgraphMarketBorrowers = async (
  marketId: string,
  network: SupportedNetworks,
  minShares = '0',
  pageSize = 10,
  skip = 0,
): Promise<PaginatedMarketBorrowers> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.warn(`No Subgraph URL configured for network: ${network}. Returning empty results.`);
    return { items: [], totalCount: 0 };
  }

  const cacheKey = getCacheKey(marketId, network, minShares);
  const now = Date.now();

  // Check cache first
  const cached = borrowersCache.get(cacheKey);
  let allMappedItems: MarketBorrower[];

  if (cached && now - cached.timestamp < CACHE_TTL) {
    // Use cached data
    allMappedItems = cached.data;
    console.log(`Using cached borrowers data for ${marketId} (${allMappedItems.length} items)`);
  } else {
    // Fetch fresh data - always fetch top 1000 items (subgraph limit)
    const variables = {
      market: marketId,
      minShares,
      first: 1000,
      skip: 0,
    };

    try {
      const result = await subgraphGraphqlFetcher<SubgraphBorrowersResponse>(subgraphUrl, marketBorrowersQuery, variables);

      const positions = result.data?.positions ?? [];
      const market = result.data?.market;

      // Get market totals for share-to-asset conversion
      const totalBorrow = BigInt(market?.totalBorrow ?? '0');
      const totalBorrowShares = BigInt(market?.totalBorrowShares ?? '0');

      // Map all items to unified type
      allMappedItems = positions.map((position) => {
        // Convert borrow shares to borrow assets
        // borrowAssets = (shares * totalBorrow) / totalBorrowShares
        const shares = BigInt(position.shares);
        let borrowAssets = '0';

        if (totalBorrowShares > 0n) {
          const assets = (shares * totalBorrow) / totalBorrowShares;
          borrowAssets = assets.toString();
        }

        // Get collateral balance from nested positions (should be exactly 1)
        const collateralBalance = position.account.positions[0]?.balance ?? '0';

        return {
          userAddress: position.account.id,
          borrowAssets,
          collateral: collateralBalance,
        };
      });

      // Update cache
      borrowersCache.set(cacheKey, {
        data: allMappedItems,
        timestamp: now,
      });

      console.log(`Fetched and cached ${allMappedItems.length} borrowers for ${marketId}`);
    } catch (error) {
      console.error(`Error fetching or processing Subgraph market borrowers for ${marketId}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while fetching subgraph market borrowers');
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
