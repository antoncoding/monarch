import { marketDepositsWithdrawsQuery } from '@/graphql/morpho-subgraph-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls'; // Import shared utility
import type { MarketActivityTransaction, PaginatedMarketActivityTransactions } from '@/utils/types';
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
 * NOTE: Because deposits and withdraws are fetched separately and merged client-side,
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
export const fetchSubgraphMarketSupplies = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
  minAssets = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.warn(`No Subgraph URL configured for network: ${network}. Returning empty results.`);
    return { items: [], totalCount: 0 };
  }

  const fetchBatchSize = 200;

  const variables = {
    marketId,
    loanAssetId,
    minAssets,
    first: fetchBatchSize,
    skip: 0,
  };

  try {
    const result = await subgraphGraphqlFetcher<SubgraphSuppliesWithdrawsResponse>(subgraphUrl, marketDepositsWithdrawsQuery, variables);

    const deposits = result.data?.deposits ?? [];
    const withdraws = result.data?.withdraws ?? [];

    const mappedDeposits: MarketActivityTransaction[] = deposits.map((d) => ({
      type: 'MarketSupply',
      hash: d.hash,
      timestamp: typeof d.timestamp === 'string' ? Number.parseInt(d.timestamp, 10) : d.timestamp,
      amount: d.amount,
      userAddress: d.account.id,
    }));

    const mappedWithdraws: MarketActivityTransaction[] = withdraws.map((w) => ({
      type: 'MarketWithdraw',
      hash: w.hash,
      timestamp: typeof w.timestamp === 'string' ? Number.parseInt(w.timestamp, 10) : w.timestamp,
      amount: w.amount,
      userAddress: w.account.id,
    }));

    // Merge and sort by timestamp, then apply client-side pagination
    const combined = [...mappedDeposits, ...mappedWithdraws];
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
    console.error(`Error fetching or processing Subgraph market supplies for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market supplies');
  }
};
