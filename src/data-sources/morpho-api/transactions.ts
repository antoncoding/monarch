import { userTransactionsQuery } from '@/graphql/morpho-api-queries';
import { UserTxTypes, type UserTransaction } from '@/utils/types';
import type { TransactionFilters, TransactionResponse } from '@/utils/user-transactions';
import { morphoGraphqlFetcher } from './fetchers';

type MorphoMarketTransactionType = 'Supply' | 'Withdraw' | 'Borrow' | 'Repay' | 'SupplyCollateral' | 'WithdrawCollateral' | 'Liquidation';

type MorphoMarketTransaction = {
  data: {
    __typename: string;
    assets?: string;
    shares?: string;
  };
  hash: string;
  logIndex: number;
  market: {
    uniqueKey: string;
  };
  timestamp: number | string;
  type: MorphoMarketTransactionType;
};

// Define the expected shape of the GraphQL response for transactions
type MorphoTransactionsApiResponse = {
  data?: {
    transactions?: Pick<TransactionResponse, 'pageInfo'> & {
      items: MorphoMarketTransaction[];
    };
  };
  // errors are handled by the fetcher
};

const MORPHO_MARKET_TRANSACTION_TYPE_MAP: Record<MorphoMarketTransactionType, UserTxTypes> = {
  Borrow: UserTxTypes.MarketBorrow,
  Liquidation: UserTxTypes.MarketLiquidation,
  Repay: UserTxTypes.MarketRepay,
  Supply: UserTxTypes.MarketSupply,
  SupplyCollateral: UserTxTypes.MarketSupplyCollateral,
  Withdraw: UserTxTypes.MarketWithdraw,
  WithdrawCollateral: UserTxTypes.MarketWithdrawCollateral,
};

const toUserTransaction = (transaction: MorphoMarketTransaction): UserTransaction => {
  const type = MORPHO_MARKET_TRANSACTION_TYPE_MAP[transaction.type];

  return {
    hash: transaction.hash,
    id: `${transaction.hash.toLowerCase()}-${transaction.logIndex}`,
    timestamp: Number(transaction.timestamp),
    type,
    data: {
      assets: transaction.data.assets ?? '0',
      market: transaction.market,
      shares: transaction.data.shares ?? '0',
      __typename: type,
    },
  };
};

export const fetchMorphoTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  // Conditionally construct the 'where' object
  const whereClause: Record<string, unknown> = {
    userAddress_in: filters.userAddress, // Assuming this is always required
    chainId_in: [filters.chainId],
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
    // Morpho exposes transaction hashes as txHash, but MarketTransactionFilters still uses hash.
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

    return {
      ...transactions,
      items: transactions.items.map(toUserTransaction),
      error: null,
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
