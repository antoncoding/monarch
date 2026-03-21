import { marketDepositsWithdrawsQuery } from '@/graphql/morpho-subgraph-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketActivityTransaction, PaginatedMarketActivityTransactions } from '@/utils/types';
import { requireSubgraphUrl, subgraphGraphqlFetcher } from './fetchers';

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
 * Because deposits and withdraws are fetched separately and merged client-side,
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
export const fetchSubgraphMarketSupplies = async (
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
    const result = await subgraphGraphqlFetcher<SubgraphSuppliesWithdrawsResponse>(subgraphUrl, marketDepositsWithdrawsQuery, variables);
    if (!result.data) {
      throw Object.assign(new Error(`Subgraph returned no supply activity data for market ${marketId} on network ${network}`), {
        source: 'subgraph' as const,
        network,
      });
    }

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
    const hasNextPage = combined.length > endIndex;
    const totalCount =
      skip >= combined.length ? combined.length : Math.max(combined.length, skip + items.length + Number(hasNextPage));

    return {
      items,
      totalCount,
      hasNextPage,
    };
  } catch (error) {
    console.error(`Error fetching or processing Subgraph market supplies for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market supplies');
  }
};
