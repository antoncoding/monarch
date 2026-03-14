import { userTransactionsQuery } from '@/graphql/morpho-api-queries';
import type { TransactionFilters, TransactionResponse } from '@/hooks/queries/fetchUserTransactions';
import { UserTxTypes, type UserTransaction } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

// Define the expected shape of the GraphQL response for transactions
type MorphoTransactionItem = Omit<UserTransaction, 'chainId'> & {
  data?: {
    __typename?: UserTxTypes;
    assets?: string;
    shares?: string;
    market?: {
      uniqueKey?: string;
      morphoBlue?: {
        chain?: {
          id?: number;
        };
      };
    };
  };
};

type MorphoTransactionsApiResponse = {
  data?: {
    transactions?: Omit<TransactionResponse, 'items'> & {
      items: MorphoTransactionItem[];
    };
  };
  // errors are handled by the fetcher
};

const resolveChainIds = (filters: TransactionFilters): number[] => {
  return [...new Set(filters.chainIds ?? (filters.chainId != null ? [filters.chainId] : []))];
};

const normalizeMorphoTransaction = (
  transaction: MorphoTransactionItem,
  fallbackChainIds: number[],
): UserTransaction | null => {
  const marketUniqueKey = transaction.data?.market?.uniqueKey;
  if (!marketUniqueKey) {
    return null;
  }

  const chainId = transaction.data?.market?.morphoBlue?.chain?.id ?? (fallbackChainIds.length === 1 ? fallbackChainIds[0] : undefined);
  if (chainId == null) {
    return null;
  }

  return {
    chainId,
    hash: transaction.hash,
    timestamp: transaction.timestamp,
    type: transaction.type,
    data: {
      __typename: transaction.data?.__typename ?? transaction.type,
      assets: transaction.data?.assets ?? '0',
      shares: transaction.data?.shares ?? '0',
      market: {
        uniqueKey: marketUniqueKey,
      },
    },
  };
};

export const fetchMorphoTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  const chainIds = resolveChainIds(filters);

  // Conditionally construct the 'where' object
  const whereClause: Record<string, unknown> = {
    userAddress_in: filters.userAddress, // Assuming this is always required
    chainId_in: chainIds,
  };

  if (filters.marketUniqueKeys && filters.marketUniqueKeys.length > 0) {
    whereClause.marketUniqueKey_in = filters.marketUniqueKeys;
  }
  if (filters.timestampGte !== undefined && filters.timestampGte !== null) {
    whereClause.timestamp_gte = filters.timestampGte;
  }
  if (filters.timestampLte !== undefined && filters.timestampLte !== null) {
    whereClause.timestamp_lte = filters.timestampLte;
  }
  if (filters.hash) {
    whereClause.hash = filters.hash;
  }
  if (filters.assetIds && filters.assetIds.length > 0) {
    whereClause.assetAddress_in = filters.assetIds;
  }

  try {
    const result = await morphoGraphqlFetcher<MorphoTransactionsApiResponse>(userTransactionsQuery, {
      where: whereClause,
      first: filters.first ?? 1000,
      skip: filters.skip ?? 0,
    });

    // Handle NOT_FOUND - return empty result
    if (!result) {
      return {
        items: [],
        pageInfo: { count: 0, countTotal: 0 },
        error: null,
      };
    }

    const transactions = result.data?.transactions;
    if (!transactions) {
      return {
        items: [],
        pageInfo: { count: 0, countTotal: 0 },
        error: 'No transaction data received from Morpho API',
      };
    }

    const normalizedItems = transactions.items
      .map((transaction) => normalizeMorphoTransaction(transaction, chainIds))
      .filter((transaction): transaction is UserTransaction => transaction !== null);

    return {
      error: transactions.error,
      items: normalizedItems,
      pageInfo: transactions.pageInfo,
    };
  } catch (err) {
    console.error('Error fetching Morpho API transactions:', err);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: err instanceof Error ? err.message : 'Unknown Morpho API error occurred',
    };
  }
};
