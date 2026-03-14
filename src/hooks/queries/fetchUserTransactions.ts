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

    if (response.items.length < pageSize) {
      break;
    }
  }

  items.sort((left, right) => right.timestamp - left.timestamp);

  return {
    items,
    pageInfo: {
      count: items.length,
      countTotal: items.length,
    },
    error: null,
  };
}
