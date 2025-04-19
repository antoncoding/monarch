export const userTransactionsQuery = `
  query getUserTransactions($first: Int, $skip: Int, $orderBy: String, $orderDirection: String, $where: UserTransactionFilter) {
    userTransactions(
      first: $first, 
      skip: $skip, 
      orderBy: $orderBy, 
      orderDirection: $orderDirection,
      where: $where
    ) {
      id
      user
      msgSender
      timestamp
      supplyCount
      withdrawCount
      supplyVolume
      withdrawVolume
      supplies {
        id
        amount
        timestamp
        market {
          id
          loan
          collateral
        }
      }
      withdrawals {
        id
        amount
        timestamp
        market {
          id
          loan
          collateral
        }
      }
    }
  }
`;

export const transactionsByTimeRangeQuery = `
  query getTransactionsByTimeRange($startTime: BigInt!, $endTime: BigInt!, $first: Int!, $skip: Int!) {
    userTransactions(
      where: { timestamp_gte: $startTime, timestamp_lte: $endTime }
      orderBy: timestamp
      orderDirection: asc
      first: $first
      skip: $skip
    ) {
      id
      user
      timestamp
      supplyCount
      withdrawCount
      supplyVolume
      withdrawVolume
      supplies {
        id
        amount
        timestamp
        market {
          id
          loan
          collateral
        }
      }
      withdrawals {
        id
        amount
        timestamp
        market {
          id
          loan
          collateral
        }
      }
    }
  }
`;

export const userGrowthQuery = `
  query getUserGrowth($startTime: BigInt!, $endTime: BigInt!, $first: Int!, $skip: Int!) {
    users(
      where: { firstTxTimestamp_gte: $startTime, firstTxTimestamp_lte: $endTime }
      orderBy: firstTxTimestamp
      orderDirection: asc
      first: $first
      skip: $skip
    ) {
      id
      firstTxTimestamp
    }
  }
`;
