import { marketBorrowsRepaysQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { MarketActivityTransaction } from '@/utils/types'; // Import shared type
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
 * @param marketId The ID of the market.
 * @param loanAssetId The address of the loan asset.
 * @param network The blockchain network.
 * @returns A promise resolving to an array of unified MarketActivityTransaction objects.
 */
export const fetchSubgraphMarketBorrows = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
): Promise<MarketActivityTransaction[]> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.error(`No Subgraph URL configured for network: ${network}`);
    throw new Error(`Subgraph URL not available for network ${network}`);
  }

  const variables = { marketId, loanAssetId };

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

    return combined;
  } catch (error) {
    console.error(`Error fetching or processing Subgraph market borrows for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market borrows');
  }
};
