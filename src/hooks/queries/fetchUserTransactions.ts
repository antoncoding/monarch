import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoTransactions } from '@/data-sources/morpho-api/transactions';
import { fetchSubgraphTransactions } from '@/data-sources/subgraph/transactions';
import { isSupportedChain } from '@/utils/networks';
import type { UserTransaction } from '@/utils/types';

/**
 * Filters for fetching user transactions.
 * Requires a single chainId - for multi-chain queries, use useUserTransactionsQuery with paginate: true.
 */
export type TransactionFilters = {
  userAddress: string[];
  chainId: number;
  marketUniqueKeys?: string[];
  timestampGte?: number;
  timestampLte?: number;
  skip?: number;
  first?: number;
  hash?: string;
  assetIds?: string[];
};

export type TransactionResponse = {
  items: UserTransaction[];
  pageInfo: {
    count: number;
    countTotal: number;
  };
  error: string | null;
};

/**
 * Fetches user transactions for a SINGLE chain from Morpho API or Subgraph.
 * For multi-chain queries, use useUserTransactionsQuery with paginate: true.
 *
 * @param filters - Transaction filters (chainId is required)
 * @returns Promise resolving to transaction response
 */
export async function fetchUserTransactions(filters: TransactionFilters): Promise<TransactionResponse> {
  const { chainId } = filters;

  // Validate chainId
  if (!isSupportedChain(chainId)) {
    console.warn(`Unsupported chain: ${chainId}`);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: `Unsupported chain: ${chainId}`,
    };
  }

  // Check subgraph user address limitation
  if (!supportsMorphoApi(chainId) && filters.userAddress.length !== 1) {
    const errorMsg = 'Subgraph data source requires exactly one user address.';
    console.error(errorMsg);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: errorMsg,
    };
  }

  // Try Morpho API first if supported
  if (supportsMorphoApi(chainId)) {
    try {
      const response = await fetchMorphoTransactions(filters);
      if (!response.error) {
        return response;
      }
      // Morpho API returned an error, fall through to Subgraph
    } catch (morphoError) {
      console.warn(`Morpho API failed for chain ${chainId}, falling back to Subgraph:`, morphoError);
      // Fall through to Subgraph
    }
  }

  // Fallback to Subgraph
  try {
    return await fetchSubgraphTransactions(filters, chainId);
  } catch (subgraphError) {
    const errorMsg = `Failed to fetch transactions: ${(subgraphError as Error)?.message ?? 'Unknown error'}`;
    console.error(errorMsg);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: errorMsg,
    };
  }
}
