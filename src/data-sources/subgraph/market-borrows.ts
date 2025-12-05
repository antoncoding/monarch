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
 * Fetches market borrow/repay activities from the Subgraph.
 * NOTE: Because borrows and repays are fetched separately and merged client-side,
 * we cannot do proper server-side pagination. Instead, we fetch a large batch (200 items)
 * from both sources, merge and sort them, then apply client-side pagination.
 * This ensures correct ordering and prevents skipped items.
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
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.error(`No Subgraph URL configured for network: ${network}`);
    throw new Error(`Subgraph URL not available for network ${network}`);
  }

  const fetchBatchSize = 200;

  const variables = { marketId, loanAssetId, minAssets, first: fetchBatchSize, skip: 0 };

  try {
    const result = await subgraphGraphqlFetcher<SubgraphBorrowsRepaysResponse>(
      subgraphUrl,
      marketBorrowsRepaysQuery,
      variables,
    );

    const borrows = result.data?.borrows ?? [];
    const repays = result.data?.repays ?? [];

    const mappedBorrows: MarketActivityTransaction[] = borrows.map((b) => ({
      type: 'MarketBorrow',
      hash: b.hash,
      timestamp: typeof b.timestamp === 'string' ? parseInt(b.timestamp, 10) : b.timestamp,
      amount: b.amount,
      userAddress: b.account.id,
    }));

    const mappedRepays: MarketActivityTransaction[] = repays.map((r) => ({
      type: 'MarketRepay',
      hash: r.hash,
      timestamp: typeof r.timestamp === 'string' ? parseInt(r.timestamp, 10) : r.timestamp,
      amount: r.amount,
      userAddress: r.account.id,
    }));

    // Merge and sort by timestamp, then apply client-side pagination
    const combined = [...mappedBorrows, ...mappedRepays];
    combined.sort((a, b) => b.timestamp - a.timestamp);

    const startIndex = skip;
    const endIndex = skip + first;
    const items = combined.slice(startIndex, endIndex);
    const totalCount = combined.length;

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
