import { subgraphUserTransactionsQuery } from '@/graphql/morpho-subgraph-queries';
import { TransactionFilters, TransactionResponse } from '@/hooks/useUserTransactions';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { UserTransaction, UserTxTypes } from '@/utils/types';
import {
  SubgraphAccountData,
  SubgraphBorrowTx,
  SubgraphDepositTx,
  SubgraphLiquidationTx,
  SubgraphRepayTx,
  SubgraphTransactionResponse,
  SubgraphWithdrawTx,
} from './types';

const transformSubgraphTransactions = (
  subgraphData: SubgraphAccountData,
  filters: TransactionFilters,
): TransactionResponse => {
  const allTransactions: UserTransaction[] = [];

  subgraphData.deposits.forEach((tx: SubgraphDepositTx) => {
    const type = tx.isCollateral ? UserTxTypes.MarketSupplyCollateral : UserTxTypes.MarketSupply;
    allTransactions.push({
      hash: tx.hash,
      timestamp: parseInt(tx.timestamp, 10),
      type: type,
      data: {
        __typename: type,
        shares: tx.shares,
        assets: tx.amount,
        market: {
          uniqueKey: tx.market.id,
        },
      },
    });
  });

  subgraphData.withdraws.forEach((tx: SubgraphWithdrawTx) => {
    const type = tx.isCollateral
      ? UserTxTypes.MarketWithdrawCollateral
      : UserTxTypes.MarketWithdraw;
    allTransactions.push({
      hash: tx.hash,
      timestamp: parseInt(tx.timestamp, 10),
      type: type,
      data: {
        __typename: type,
        shares: tx.shares,
        assets: tx.amount,
        market: {
          uniqueKey: tx.market.id,
        },
      },
    });
  });

  subgraphData.borrows.forEach((tx: SubgraphBorrowTx) => {
    allTransactions.push({
      hash: tx.hash,
      timestamp: parseInt(tx.timestamp, 10),
      type: UserTxTypes.MarketBorrow,
      data: {
        __typename: UserTxTypes.MarketBorrow,
        shares: tx.shares,
        assets: tx.amount,
        market: {
          uniqueKey: tx.market.id,
        },
      },
    });
  });

  subgraphData.repays.forEach((tx: SubgraphRepayTx) => {
    allTransactions.push({
      hash: tx.hash,
      timestamp: parseInt(tx.timestamp, 10),
      type: UserTxTypes.MarketRepay,
      data: {
        __typename: UserTxTypes.MarketRepay,
        shares: tx.shares,
        assets: tx.amount,
        market: {
          uniqueKey: tx.market.id,
        },
      },
    });
  });

  subgraphData.liquidations.forEach((tx: SubgraphLiquidationTx) => {
    allTransactions.push({
      hash: tx.hash,
      timestamp: parseInt(tx.timestamp, 10),
      type: UserTxTypes.MarketLiquidation,
      data: {
        __typename: UserTxTypes.MarketLiquidation,
        shares: '0',
        assets: tx.repaid,
        market: {
          uniqueKey: tx.market.id,
        },
      },
    });
  });

  allTransactions.sort((a, b) => b.timestamp - a.timestamp);

  // marketUniqueKeys is empty: all markets
  const filteredTransactions =
    filters.marketUniqueKeys?.length === 0
      ? allTransactions
      : allTransactions.filter(
          (tx) => filters.marketUniqueKeys?.includes(tx.data.market.uniqueKey),
        );

  const count = filteredTransactions.length;
  const countTotal = count;

  return {
    items: filteredTransactions,
    pageInfo: {
      count: count,
      countTotal: countTotal,
    },
    error: null,
  };
};

export const fetchSubgraphTransactions = async (
  filters: TransactionFilters,
  network: SupportedNetworks,
): Promise<TransactionResponse> => {
  if (filters.userAddress.length !== 1) {
    console.warn('Subgraph fetcher currently supports only one user address.');
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: null,
    };
  }

  const subgraphUrl = getSubgraphUrl(network);

  if (!subgraphUrl) {
    const errorMsg = `Subgraph URL not found for network ${network}. Check API key and configuration.`;
    console.error(errorMsg);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: errorMsg,
    };
  }

  const userAddress = filters.userAddress[0].toLowerCase();

  // Always calculate current timestamp (seconds)
  const currentTimestamp = Math.floor(Date.now() / 1000);

  // Construct variables with mandatory timestamp filters
  const variables: Record<string, any> = {
    userId: userAddress,
    first: filters.first ?? 1000,
    skip: filters.skip ?? 0,
    timestamp_gt: 0, // Always start from time 0
    timestamp_lt: currentTimestamp, // Always end at current time
  };

  if (filters.timestampGte !== undefined && filters.timestampGte !== null) {
    variables.timestamp_gte = filters.timestampGte;
  }
  if (filters.timestampLte !== undefined && filters.timestampLte !== null) {
    variables.timestamp_lte = filters.timestampLte;
  }

  const requestBody = {
    query: subgraphUserTransactionsQuery,
    variables: variables,
  };

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = (await response.json()) as SubgraphTransactionResponse;

    if (result.errors) {
      throw new Error(result.errors.map((e) => e.message).join(', '));
    }

    if (!result.data?.account) {
      return {
        items: [],
        pageInfo: { count: 0, countTotal: 0 },
        error: null,
      };
    }

    return transformSubgraphTransactions(result.data.account, filters);
  } catch (err) {
    console.error(`Error fetching Subgraph transactions from ${subgraphUrl}:`, err);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: err instanceof Error ? err.message : 'Unknown Subgraph error occurred',
    };
  }
};
