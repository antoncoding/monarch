import { hasEnvioIndexer } from '@/config/dataSources';
import { fetchEnvioTransactions } from '@/data-sources/envio/transactions';
import { fetchMorphoTransactions } from '@/data-sources/morpho-api/transactions';
import { isSupportedChain } from '@/utils/networks';
import type { UserTransaction } from '@/utils/types';

/**
 * Filters for fetching user transactions.
 */
export type TransactionFilters = {
  userAddress: string[];
  chainId?: number;
  chainIds?: number[];
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

const getUserTransactionDedupKey = (transaction: UserTransaction): string => {
  const marketKey = transaction.data.market.uniqueKey.toLowerCase();
  return `${transaction.chainId}:${transaction.hash.toLowerCase()}:${transaction.type}:${marketKey}:${transaction.data.assets}:${transaction.data.shares}`;
};

const resolveTransactionChainIds = (filters: TransactionFilters): number[] => {
  const chainIds = filters.chainIds ?? (filters.chainId != null ? [filters.chainId] : []);
  return [...new Set(chainIds)];
};

/**
 * Fetches user transactions for one or more chains using the configured indexer source.
 *
 * @param filters - Transaction filters
 * @returns Promise resolving to transaction response
 */
export async function fetchUserTransactions(filters: TransactionFilters): Promise<TransactionResponse> {
  const chainIds = resolveTransactionChainIds(filters);

  if (chainIds.length === 0) {
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: 'At least one chainId is required',
    };
  }

  const unsupportedChainId = chainIds.find((chainId) => !isSupportedChain(chainId));
  if (unsupportedChainId != null) {
    console.warn(`Unsupported chain: ${unsupportedChainId}`);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: `Unsupported chain: ${unsupportedChainId}`,
    };
  }

  const normalizedFilters: TransactionFilters = {
    ...filters,
    chainIds,
    chainId: chainIds.length === 1 ? chainIds[0] : undefined,
  };

  if (hasEnvioIndexer()) {
    try {
      const response = await fetchEnvioTransactions(normalizedFilters);
      if (!response.error) {
        return response;
      }
    } catch (envioError) {
      console.warn(`Envio failed for chains ${chainIds.join(',')}, falling back to Morpho API:`, envioError);
    }
  }

  return fetchMorphoTransactions(normalizedFilters);
}

export async function fetchAllUserTransactions(
  filters: Omit<TransactionFilters, 'skip' | 'first'> & {
    chainId?: number;
    chainIds?: number[];
  },
  options: {
    pageSize?: number;
    maxPages?: number;
  } = {},
): Promise<TransactionResponse> {
  const pageSize = options.pageSize ?? 1000;
  const maxPages = options.maxPages ?? 50;
  const items: UserTransaction[] = [];
  let expectedTotalCount: number | null = null;
  let rawFetchedCount = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchUserTransactions({
      ...filters,
      first: pageSize,
      skip: page * pageSize,
    });

    if (response.error) {
      return response;
    }

    items.push(...response.items);
    rawFetchedCount += response.items.length;
    expectedTotalCount ??= response.pageInfo.countTotal;

    if (response.items.length === 0 || rawFetchedCount >= expectedTotalCount) {
      break;
    }
  }

  if (expectedTotalCount != null && rawFetchedCount < expectedTotalCount) {
    return {
      items: [],
      pageInfo: { count: 0, countTotal: expectedTotalCount },
      error: `Transaction pagination hit the maxPages limit (${maxPages}) before completion.`,
    };
  }

  const dedupedItems = new Map<string, UserTransaction>();
  for (const item of items) {
    const dedupKey = getUserTransactionDedupKey(item);
    if (!dedupedItems.has(dedupKey)) {
      dedupedItems.set(dedupKey, item);
    }
  }

  const sortedItems = Array.from(dedupedItems.values()).sort((left, right) => right.timestamp - left.timestamp);

  return {
    items: sortedItems,
    pageInfo: {
      count: sortedItems.length,
      countTotal: sortedItems.length,
    },
    error: null,
  };
}
