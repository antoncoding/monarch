import { marketBorrowsRepaysQuery } from '@/graphql/morpho-subgraph-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketActivityTransaction, PaginatedMarketActivityTransactions } from '@/utils/types'; // Import shared type
import { requireSubgraphUrl, subgraphGraphqlFetcher } from './fetchers';

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
 * Fetches market borrow/repay activities from the Subgraph.
 * Because borrows and repays are fetched separately and merged client-side,
 * we fetch the requested prefix window from both streams, merge them, and then
 * derive the requested page plus `hasNextPage`.
 * @param marketId The ID of the market.
 * @param loanAssetId The address of the loan asset.
 * @param network The blockchain network.
 * @param minAssets Minimum asset amount to filter transactions (optional, defaults to 0).
 * @param first Number of items to return per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketActivityTransaction objects.
 */
export const fetchSubgraphMarketBorrows = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
  minAssets = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const subgraphUrl = requireSubgraphUrl(network);

  const fetchBatchSize = skip + first + 1;

  const variables = {
    marketId,
    loanAssetId,
    minAssets,
    first: fetchBatchSize,
    skip: 0,
  };

  try {
    const result = await subgraphGraphqlFetcher<SubgraphBorrowsRepaysResponse>(subgraphUrl, marketBorrowsRepaysQuery, variables);
    if (!result.data) {
      throw Object.assign(new Error(`Subgraph returned no borrow activity data for market ${marketId} on network ${network}`), {
        source: 'subgraph' as const,
        network,
      });
    }

    const borrows = result.data?.borrows ?? [];
    const repays = result.data?.repays ?? [];

    const mappedBorrows: MarketActivityTransaction[] = borrows.map((b) => ({
      type: 'MarketBorrow',
      hash: b.hash,
      timestamp: typeof b.timestamp === 'string' ? Number.parseInt(b.timestamp, 10) : b.timestamp,
      amount: b.amount,
      userAddress: b.account.id,
    }));

    const mappedRepays: MarketActivityTransaction[] = repays.map((r) => ({
      type: 'MarketRepay',
      hash: r.hash,
      timestamp: typeof r.timestamp === 'string' ? Number.parseInt(r.timestamp, 10) : r.timestamp,
      amount: r.amount,
      userAddress: r.account.id,
    }));

    // Merge and sort by timestamp, then apply client-side pagination
    const combined = [...mappedBorrows, ...mappedRepays];
    combined.sort((a, b) => b.timestamp - a.timestamp);

    const startIndex = skip;
    const endIndex = skip + first;
    const items = combined.slice(startIndex, endIndex);
    const hasNextPage = combined.length > endIndex;
    const totalCount = skip >= combined.length ? combined.length : Math.max(combined.length, skip + items.length + Number(hasNextPage));

    return {
      items,
      totalCount,
      hasNextPage,
    };
  } catch (error) {
    console.error(`Error fetching or processing Subgraph market borrows for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market borrows');
  }
};
