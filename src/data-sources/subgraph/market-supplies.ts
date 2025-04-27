import { marketDepositsWithdrawsQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls'; // Import shared utility
import { MarketActivityTransaction } from '@/utils/types';
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
 * Uses the shared subgraph fetcher and URL utility.
 * @param marketId The ID of the market.
 * @param loanAssetId The address of the loan asset.
 * @param network The blockchain network.
 * @returns A promise resolving to an array of unified MarketActivityTransaction objects.
 */
export const fetchSubgraphMarketSupplies = async (
  marketId: string,
  loanAssetId: string,
  network: SupportedNetworks,
): Promise<MarketActivityTransaction[]> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    // Error handling for missing URL remains important
    console.error(`No Subgraph URL configured for network: ${network}`);
    throw new Error(`Subgraph URL not available for network ${network}`);
  }

  const variables = {
    marketId, // Ensure these match the types expected by the Subgraph query (e.g., Bytes)
    loanAssetId,
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

    return combined;
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
