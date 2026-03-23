import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchUserTransactions } from '@/data-sources/monarch-api/user-transactions';
import { fetchMorphoTransactions } from '@/data-sources/morpho-api/transactions';
import { fetchSubgraphTransactions } from '@/data-sources/subgraph/transactions';
import { isSupportedChain } from '@/utils/networks';
import type { UserTransaction } from '@/utils/types';
import {
  compareUserTransactions,
  emptyTransactionResponse,
  type TransactionFilters,
  type TransactionResponse,
} from '@/utils/user-transactions';

const MAX_FALLBACK_PAGES = 50;

const canUseMonarchTransactions = (filters: TransactionFilters): boolean => {
  return !filters.assetIds?.length;
};

const fetchFallbackUserTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  const { chainId } = filters;

  if (!supportsMorphoApi(chainId) && filters.userAddress.length !== 1) {
    const errorMsg = 'Subgraph data source requires exactly one user address.';
    console.error(errorMsg);
    return emptyTransactionResponse(errorMsg);
  }

  if (supportsMorphoApi(chainId)) {
    try {
      const response = await fetchMorphoTransactions(filters);
      if (!response.error) {
        return response;
      }
    } catch (morphoError) {
      console.warn(`Morpho API failed for chain ${chainId}, falling back to Subgraph:`, morphoError);
    }
  }

  try {
    return await fetchSubgraphTransactions(filters, chainId);
  } catch (subgraphError) {
    const errorMsg = `Failed to fetch transactions: ${(subgraphError as Error)?.message ?? 'Unknown error'}`;
    console.error(errorMsg);
    return emptyTransactionResponse(errorMsg);
  }
};

/**
 * Fetches user transactions for a SINGLE chain from Monarch, Morpho API, or Subgraph.
 * For multi-chain queries, use useUserTransactionsQuery with paginate: true.
 *
 * @param filters - Transaction filters (chainId is required)
 * @returns Promise resolving to transaction response
 */
export async function fetchUserTransactions(filters: TransactionFilters): Promise<TransactionResponse> {
  const { chainId } = filters;

  if (filters.userAddress.length === 0) {
    return emptyTransactionResponse();
  }

  if (!isSupportedChain(chainId)) {
    console.warn(`Unsupported chain: ${chainId}`);
    return emptyTransactionResponse(`Unsupported chain: ${chainId}`);
  }

  if (canUseMonarchTransactions(filters)) {
    try {
      const response = await fetchMonarchUserTransactions(filters);
      if (!response.error) {
        return response;
      }
    } catch (monarchError) {
      console.warn(`Monarch API failed for chain ${chainId}, falling back to Morpho/Subgraph:`, monarchError);
    }
  }

  return fetchFallbackUserTransactions(filters);
}

export async function fetchAllUserTransactions(filters: TransactionFilters, pageSize = 1000): Promise<TransactionResponse> {
  const frozenFilters: TransactionFilters = {
    ...filters,
    timestampLte: filters.timestampLte ?? Math.floor(Date.now() / 1000),
  };
  const { chainId } = filters;

  if (frozenFilters.userAddress.length === 0) {
    return emptyTransactionResponse();
  }

  if (!isSupportedChain(chainId)) {
    console.warn(`Unsupported chain: ${chainId}`);
    return emptyTransactionResponse(`Unsupported chain: ${chainId}`);
  }

  if (canUseMonarchTransactions(frozenFilters)) {
    try {
      const response = await fetchMonarchUserTransactions({
        ...frozenFilters,
        first: undefined,
        skip: 0,
      });
      if (!response.error) {
        return response;
      }
    } catch (monarchError) {
      console.warn(`Monarch API failed for chain ${chainId}, falling back to Morpho/Subgraph:`, monarchError);
    }
  }

  const allItems: UserTransaction[] = [];

  for (let page = 0; page < MAX_FALLBACK_PAGES; page++) {
    const response = await fetchFallbackUserTransactions({
      ...frozenFilters,
      first: pageSize,
      skip: page * pageSize,
    });

    if (response.error && response.items.length === 0) {
      return response;
    }

    allItems.push(...response.items);

    if (response.items.length < pageSize) {
      break;
    }
  }

  allItems.sort(compareUserTransactions);

  return {
    items: allItems,
    pageInfo: {
      count: allItems.length,
      countTotal: allItems.length,
    },
    error: null,
  };
}
