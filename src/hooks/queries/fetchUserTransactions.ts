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
const FALLBACK_PARALLEL_PAGE_BATCH_SIZE = 5;

type FallbackTransactionsSource = 'morpho' | 'subgraph';

const canUseMonarchTransactions = (filters: TransactionFilters): boolean => {
  return !filters.assetIds?.length;
};

const fetchFallbackTransactionsFromSource = async (
  source: FallbackTransactionsSource,
  filters: TransactionFilters,
): Promise<TransactionResponse> => {
  const { chainId } = filters;

  if (source === 'morpho') {
    try {
      return await fetchMorphoTransactions(filters);
    } catch (morphoError) {
      const errorMsg = `Failed to fetch transactions from Morpho API: ${(morphoError as Error)?.message ?? 'Unknown error'}`;
      console.warn(`Morpho API failed for chain ${chainId}:`, morphoError);
      return emptyTransactionResponse(errorMsg);
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

const selectFallbackUserTransactionsSource = async (
  filters: TransactionFilters,
): Promise<{ source: FallbackTransactionsSource | null; response: TransactionResponse }> => {
  const { chainId } = filters;

  if (supportsMorphoApi(chainId)) {
    const morphoResponse = await fetchFallbackTransactionsFromSource('morpho', filters);
    if (!morphoResponse.error) {
      return {
        source: 'morpho',
        response: morphoResponse,
      };
    }
  }

  if (filters.userAddress.length !== 1) {
    const errorMsg = 'Subgraph data source requires exactly one user address.';
    console.error(errorMsg);
    return {
      source: null,
      response: emptyTransactionResponse(errorMsg),
    };
  }

  const subgraphResponse = await fetchFallbackTransactionsFromSource('subgraph', filters);
  return {
    source: subgraphResponse.error ? null : 'subgraph',
    response: subgraphResponse,
  };
};

const fetchFallbackUserTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  const { response } = await selectFallbackUserTransactionsSource(filters);
  return response;
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
  const firstPageFilters: TransactionFilters = {
    ...frozenFilters,
    first: pageSize,
    skip: 0,
  };
  const { source, response: firstPage } = await selectFallbackUserTransactionsSource(firstPageFilters);

  if (!source || (firstPage.error && firstPage.items.length === 0)) {
    return firstPage;
  }

  allItems.push(...firstPage.items);

  if (source === 'morpho') {
    const totalPages = Math.ceil(firstPage.pageInfo.countTotal / pageSize);
    if (totalPages > MAX_FALLBACK_PAGES) {
      return emptyTransactionResponse(`Fallback transaction history exceeded the safe pagination limit (${totalPages} pages)`);
    }

    for (let startPage = 1; startPage < totalPages; startPage += FALLBACK_PARALLEL_PAGE_BATCH_SIZE) {
      const endPage = Math.min(startPage + FALLBACK_PARALLEL_PAGE_BATCH_SIZE, totalPages);
      const batchPages = Array.from({ length: endPage - startPage }, (_, index) => startPage + index);
      const batchResponses = await Promise.all(
        batchPages.map((page) =>
          fetchFallbackTransactionsFromSource(source, {
            ...frozenFilters,
            first: pageSize,
            skip: page * pageSize,
          }),
        ),
      );

      const failedResponse = batchResponses.find((response) => response.error);
      if (failedResponse) {
        return emptyTransactionResponse(failedResponse.error);
      }

      allItems.push(...batchResponses.flatMap((response) => response.items));
    }

    allItems.sort(compareUserTransactions);

    return {
      items: allItems,
      pageInfo: {
        count: allItems.length,
        countTotal: firstPage.pageInfo.countTotal,
      },
      error: null,
    };
  }

  for (let page = 1; page < MAX_FALLBACK_PAGES; page++) {
    const response = await fetchFallbackTransactionsFromSource(source, {
      ...frozenFilters,
      first: pageSize,
      skip: page * pageSize,
    });

    if (response.error) {
      return emptyTransactionResponse(response.error);
    }

    allItems.push(...response.items);

    if (response.items.length < pageSize) {
      break;
    }

    if (page === MAX_FALLBACK_PAGES - 1) {
      return emptyTransactionResponse('Fallback transaction history exceeded the safe pagination limit');
    }
  }

  allItems.sort(compareUserTransactions);

  return {
    items: allItems,
    pageInfo: {
      count: allItems.length,
      countTotal: source === 'subgraph' ? allItems.length : firstPage.pageInfo.countTotal,
    },
    error: null,
  };
}
