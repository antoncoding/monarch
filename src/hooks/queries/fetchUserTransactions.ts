import { supportsMorphoApiChainId } from '@/config/dataSources';
import { fetchMonarchAdaptersByAddress, isRecognizedMorphoMarketAdapterType } from '@/data-sources/monarch-api/vaults';
import { fetchMonarchUserTransactions } from '@/data-sources/monarch-api/user-transactions';
import { fetchMorphoTransactions } from '@/data-sources/morpho-api/transactions';
import { isSupportedChain, type SupportedNetworks } from '@/utils/networks';
import type { UserTransaction } from '@/utils/types';
import {
  compareUserTransactions,
  emptyTransactionResponse,
  type TransactionFilters,
  type TransactionResponse,
} from '@/utils/user-transactions';

const MAX_FALLBACK_PAGES = 50;
const FALLBACK_PARALLEL_PAGE_BATCH_SIZE = 5;

const canUseMonarchTransactions = (filters: TransactionFilters): boolean => !filters.assetIds?.length;

const shouldFallbackOnEmptyMonarchHistory = async (filters: TransactionFilters): Promise<boolean> => {
  if (!isSupportedChain(filters.chainId) || filters.userAddress.length === 0) {
    return false;
  }

  const normalizedAddresses = Array.from(new Set(filters.userAddress.map((address) => address.toLowerCase()).filter(Boolean)));
  if (normalizedAddresses.length === 0) {
    return false;
  }

  try {
    const adapterDetails = await fetchMonarchAdaptersByAddress(normalizedAddresses, filters.chainId as SupportedNetworks);
    if (adapterDetails.length === 0) {
      return false;
    }

    return normalizedAddresses.every((address) =>
      adapterDetails.some(
        (adapterDetail) => adapterDetail.address === address && isRecognizedMorphoMarketAdapterType(adapterDetail.adapterType),
      ),
    );
  } catch (adapterLookupError) {
    console.warn(`Failed to resolve adapter metadata for chain ${filters.chainId}:`, adapterLookupError);
    return false;
  }
};

const fetchMorphoFallbackTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  const { chainId } = filters;

  if (!supportsMorphoApiChainId(chainId)) {
    return emptyTransactionResponse(`Morpho API does not support chain ${chainId}`);
  }

  try {
    return await fetchMorphoTransactions(filters);
  } catch (morphoError) {
    const errorMsg = `Failed to fetch transactions from Morpho API: ${(morphoError as Error)?.message ?? 'Unknown error'}`;
    console.warn(`Morpho API failed for chain ${chainId}:`, morphoError);
    return emptyTransactionResponse(errorMsg);
  }
};

/**
 * Fetches user transactions for a single chain from Monarch or Morpho API.
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
      const shouldFallbackOnEmpty = !response.error && response.items.length === 0 && (await shouldFallbackOnEmptyMonarchHistory(filters));
      if (!response.error && !shouldFallbackOnEmpty) {
        return response;
      }
    } catch (monarchError) {
      console.warn(`Monarch API failed for chain ${chainId}, falling back to Morpho API:`, monarchError);
    }
  }

  return fetchMorphoFallbackTransactions(filters);
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
      const shouldFallbackOnEmpty =
        !response.error && response.items.length === 0 && (await shouldFallbackOnEmptyMonarchHistory(frozenFilters));
      if (!response.error && !shouldFallbackOnEmpty) {
        return response;
      }
    } catch (monarchError) {
      console.warn(`Monarch API failed for chain ${chainId}, falling back to Morpho API:`, monarchError);
    }
  }

  const allItems: UserTransaction[] = [];
  const firstPageFilters: TransactionFilters = {
    ...frozenFilters,
    first: pageSize,
    skip: 0,
  };
  const firstPage = await fetchMorphoFallbackTransactions(firstPageFilters);

  if (firstPage.error && firstPage.items.length === 0) {
    return firstPage;
  }

  allItems.push(...firstPage.items);

  const totalPages = Math.ceil(firstPage.pageInfo.countTotal / pageSize);
  if (totalPages > MAX_FALLBACK_PAGES) {
    return emptyTransactionResponse(`Fallback transaction history exceeded the safe pagination limit (${totalPages} pages)`);
  }

  for (let startPage = 1; startPage < totalPages; startPage += FALLBACK_PARALLEL_PAGE_BATCH_SIZE) {
    const endPage = Math.min(startPage + FALLBACK_PARALLEL_PAGE_BATCH_SIZE, totalPages);
    const batchPages = Array.from({ length: endPage - startPage }, (_, index) => startPage + index);
    const batchResponses = await Promise.all(
      batchPages.map((page) =>
        fetchMorphoFallbackTransactions({
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
