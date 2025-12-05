import { marketDepositsWithdrawsQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls'; // Import shared utility
import { MarketActivityTransaction, PaginatedMarketActivityTransactions } from '@/utils/types';
import { subgraphGraphqlFetcher } from './fetchers'; // Import shared fetcher

// Types specific to the Subgraph response for this query
type SubgraphSupplyWithdrawItem = {
  amount: string;
  account: {
    id: string;
  };
  timestamp: number | string; // Allow string timestamp from subgraph
  hash: string;
};

type SubgraphSuppliesWithdrawsResponse = {
  data?: {
    deposits?: SubgraphSupplyWithdrawItem[];
    withdraws?: SubgraphSupplyWithdrawItem[];
  };
  // Error handling is now done by the fetcher
};

/**
 * Fetches market supply/withdraw activities (deposits/withdraws of loan asset) from the Subgraph.
 * Uses the shared subgraph fetcher and URL utility with server-side pagination.
 * @param marketId The ID of the market.
 * @param loanAssetId The address of the loan asset.
 * @param network The blockchain network.
 * @param minAssets Minimum asset amount to filter transactions (optional, defaults to 0).
 * @param first Number of items to fetch per page (optional, defaults to 8).
 * @param skip Number of items to skip for pagination (optional, defaults to 0).
 * @returns A promise resolving to paginated MarketActivityTransaction objects.
 */
export const fetchSubgraphMarketSupplies = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
  minAssets: string = '0',
  first: number = 8,
  skip: number = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    // Error handling for missing URL remains important
    console.error(`No Subgraph URL configured for network: ${network}`);
    throw new Error(`Subgraph URL not available for network ${network}`);
  }

  // Fetch one extra item to detect if there are more pages
  const fetchFirst = first + 1;

  const variables = {
    marketId, // Ensure these match the types expected by the Subgraph query (e.g., Bytes)
    loanAssetId,
    minAssets,
    first: fetchFirst,
    skip,
  };

  try {
    // Use the shared fetcher
    const result = await subgraphGraphqlFetcher<SubgraphSuppliesWithdrawsResponse>(
      subgraphUrl,
      marketDepositsWithdrawsQuery,
      variables,
    );

    // Fetcher handles network and basic GraphQL errors, proceed with data processing
    const deposits = result.data?.deposits ?? [];
    const withdraws = result.data?.withdraws ?? [];

    // Map deposits and withdraws to the unified type
    const mappedDeposits: MarketActivityTransaction[] = deposits.map((d) => ({
      type: 'MarketSupply',
      hash: d.hash,
      // Ensure timestamp is treated as a number
      timestamp: typeof d.timestamp === 'string' ? parseInt(d.timestamp, 10) : d.timestamp,
      amount: d.amount,
      userAddress: d.account.id,
    }));

    const mappedWithdraws: MarketActivityTransaction[] = withdraws.map((w) => ({
      type: 'MarketWithdraw',
      hash: w.hash,
      timestamp: typeof w.timestamp === 'string' ? parseInt(w.timestamp, 10) : w.timestamp,
      amount: w.amount,
      userAddress: w.account.id,
    }));

    // Combine and sort by timestamp descending (most recent first)
    const combined = [...mappedDeposits, ...mappedWithdraws];
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
    // Catch errors from the fetcher or during processing
    console.error(`Error fetching or processing Subgraph market supplies for ${marketId}:`, error);
    // Re-throw the error to be handled by the calling hook (useQuery)
    // Ensuring the error object is an instance of Error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market supplies');
  }
};
