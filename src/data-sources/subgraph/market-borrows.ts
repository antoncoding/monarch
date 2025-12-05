import { marketBorrowsRepaysQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { MarketActivityTransaction, PaginatedMarketActivityTransactions } from '@/utils/types'; // Import shared type
import { subgraphGraphqlFetcher } from './fetchers';

// Types specific to the Subgraph response for this query
type SubgraphBorrowRepayItem = {
  amount: string;
  account: {
    id: string;
  };
  timestamp: number | string;
  hash: string;
};

type SubgraphBorrowsRepaysResponse = {
  data?: {
    borrows?: SubgraphBorrowRepayItem[];
    repays?: SubgraphBorrowRepayItem[];
  };
};

/**
 * Fetches market borrow/repay activities from the Subgraph with server-side pagination.
 * @param marketId The ID of the market.
 * @param loanAssetId The address of the loan asset.
 * @param network The blockchain network.
 * @param minAssets Minimum asset amount to filter transactions (optional, defaults to 0).
 * @param first Number of items to fetch per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketActivityTransaction objects.
 */
export const fetchSubgraphMarketBorrows = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
  minAssets: string = '0',
  first: number = 8,
  skip: number = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.error(`No Subgraph URL configured for network: ${network}`);
    throw new Error(`Subgraph URL not available for network ${network}`);
  }

  // Fetch one extra item to detect if there are more pages
  const fetchFirst = first + 1;

  const variables = { marketId, loanAssetId, minAssets, first: fetchFirst, skip };

  try {
    const result = await subgraphGraphqlFetcher<SubgraphBorrowsRepaysResponse>(
      subgraphUrl,
      marketBorrowsRepaysQuery,
      variables,
    );

    const borrows = result.data?.borrows ?? [];
    const repays = result.data?.repays ?? [];

    // Map borrows to the unified type
    const mappedBorrows: MarketActivityTransaction[] = borrows.map((b) => ({
      type: 'MarketBorrow',
      hash: b.hash,
      timestamp: typeof b.timestamp === 'string' ? parseInt(b.timestamp, 10) : b.timestamp,
      amount: b.amount,
      userAddress: b.account.id,
    }));

    // Map repays to the unified type
    const mappedRepays: MarketActivityTransaction[] = repays.map((r) => ({
      type: 'MarketRepay',
      hash: r.hash,
      timestamp: typeof r.timestamp === 'string' ? parseInt(r.timestamp, 10) : r.timestamp,
      amount: r.amount,
      userAddress: r.account.id,
    }));

    // Combine and sort by timestamp descending
    const combined = [...mappedBorrows, ...mappedRepays];
    combined.sort((a, b) => b.timestamp - a.timestamp);

    // Check if we got more items than requested (meaning there are more pages)
    const hasMore = combined.length > first;

    // Return only the requested number of items (not the extra one)
    const items = hasMore ? combined.slice(0, first) : combined;

    // Estimate total count:
    // - If we got more items than requested, we know there's at least skip + first + 1
    // - Otherwise, the total is skip + actual items received
    const totalCount = hasMore ? skip + first + 1 : skip + items.length;

    return {
      items,
      totalCount,
    };
  } catch (error) {
    console.error(`Error fetching or processing Subgraph market borrows for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market borrows');
  }
};
