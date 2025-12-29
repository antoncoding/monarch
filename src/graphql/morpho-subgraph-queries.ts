export const tokenFragment = `
  fragment TokenFields on Token {
    id
    name
    symbol
    decimals
    lastPriceUSD
  }
`;

export const oracleFragment = `
  fragment OracleFields on Oracle {
    id
    oracleAddress
    oracleSource
    isActive
    isUSD
  }
`;

export const marketFragment = `
  fragment SubgraphMarketFields on Market {
    id
    lltv
    irm
    inputToken { # collateralAsset
      ...TokenFields
    }
    inputTokenPriceUSD
    borrowedToken { # loanAsset
      ...TokenFields
    }
    totalDepositBalanceUSD
    totalBorrowBalanceUSD
    totalSupplyShares
    totalBorrowShares
    totalSupply
    totalBorrow
    totalCollateral
    fee

    name
    isActive
    canBorrowFrom
    canUseAsCollateral
    maximumLTV
    liquidationThreshold
    liquidationPenalty
    createdTimestamp
    createdBlockNumber
    inputTokenBalance
    variableBorrowedTokenBalance
    totalValueLockedUSD
    lastUpdate
    reserves
    reserveFactor
    oracle {
      ...OracleFields
    }
    rates {
      id
      rate # APY
      side
      type
    }
    protocol {
      id
      network # Chain Name
      protocol # Protocol Name
    }
  }
  ${tokenFragment}
  ${oracleFragment}
`;

export const marketsQuery = `
  query getSubgraphMarkets($first: Int, $where: Market_filter, $network: String) {
    markets(
      first: $first,
      where: $where,
      orderBy: totalValueLockedUSD,
      orderDirection: desc,
    ) {
      ...SubgraphMarketFields
    }
  }
  ${marketFragment}
`;

// Add other queries as needed, e.g., for user positions based on subgraph schema

export const marketQuery = `
  query getSubgraphMarket($id: Bytes!) {
    market(id: $id) {
      ...SubgraphMarketFields
    }
  }
  ${marketFragment}
`;

// --- Added for Historical Data ---

export const marketHourlySnapshotFragment = `
  fragment MarketHourlySnapshotFields on MarketHourlySnapshot {
    id
    timestamp
    market {
      id
      inputToken { 
        ...TokenFields
      }
      borrowedToken {
        ...TokenFields
      }
    }
    rates {
      id
      rate # APY
      side
      type
    }
    totalDepositBalanceUSD
    totalBorrowBalanceUSD
    inputTokenBalance
    inputTokenPriceUSD
    hourlyDepositUSD
    hourlyBorrowUSD
    outputTokenSupply
    variableBorrowedTokenBalance
    # Note: The subgraph schema for snapshots doesn't seem to directly expose
    # total native supply/borrow amounts historically, only USD values and hourly deltas.
  }
`;

export const marketHourlySnapshotsQuery = `
  query getMarketHourlySnapshots($marketId: Bytes!, $startTimestamp: BigInt!, $endTimestamp: BigInt!) {
    marketHourlySnapshots(
      first: 1000, # Subgraph max limit
      orderBy: timestamp,
      orderDirection: asc,
      where: {
        market: $marketId,
        timestamp_gte: $startTimestamp,
        timestamp_lte: $endTimestamp
      }
    ) {
      ...MarketHourlySnapshotFields
    }
  }
  ${marketHourlySnapshotFragment}
  ${tokenFragment} # Ensure TokenFields fragment is included
`;
// --- End Added Section ---

// --- Query for Market Supplies/Withdraws (Deposits/Withdraws of Loan Asset) ---
export const marketDepositsWithdrawsQuery = `
  query getMarketDepositsWithdraws($marketId: Bytes!, $loanAssetId: Bytes!, $minAssets: String, $first: Int!, $skip: Int!) {
    deposits(
      first: $first,
      skip: $skip,
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId, amount_gt: $minAssets }
    ) {
      amount
      account { id }
      timestamp
      hash
    }
    withdraws(
      first: $first,
      skip: $skip,
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId, amount_gt: $minAssets }
    ) {
      amount
      account { id }
      timestamp
      hash
    }
  }
`;
// --- End Query ---

// --- Query for Market Borrows/Repays (Borrows/Repays of Loan Asset) ---
export const marketBorrowsRepaysQuery = `
  query getMarketBorrowsRepays($marketId: Bytes!, $loanAssetId: Bytes!, $minAssets: BigInt, $first: Int!, $skip: Int!) {
    borrows(
      first: $first,
      skip: $skip,
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId, amount_gt: $minAssets }
    ) {
      amount
      account { id }
      timestamp
      hash
    }
    repays(
      first: $first,
      skip: $skip,
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId, amount_gt: $minAssets }
    ) {
      amount
      account { id }
      timestamp
      hash
    }
  }
`;
// --- End Query ---

// --- Query for Market Liquidations and Bad Debt ---
export const marketLiquidationsAndBadDebtQuery = `
  query getMarketLiquidations($marketId: Bytes!) {
    liquidates(
      first: 1000,
      where: { market: $marketId },
      orderBy: timestamp,
      orderDirection: desc
    ) {
      id
      hash
      timestamp
      repaid
      amount
      liquidator { id }
    }
    badDebtRealizations(
      first: 1000,
      where: { market: $marketId }
    ) {
      badDebt
      liquidation { id }
    }
  }
`;
// --- End Query ---

// --- Query to check which markets have had at least one liquidation ---
export const subgraphMarketsWithLiquidationCheckQuery = `
  query getSubgraphMarketsWithLiquidationCheck(
    $first: Int,
    $where: Market_filter,
  ) {
    markets(
      first: $first,
      where: $where,
      orderBy: totalValueLockedUSD,
      orderDirection: desc,
    ) {
      id # Market ID (uniqueKey)
      liquidates(first: 1) { # Fetch only one to check existence
        id
      }
    }
  }
`;

// --- Query for User Position Market IDs ---
export const subgraphUserPositionMarketsQuery = `
  query GetUserPositionMarkets($userId: ID!) {
    account(id: $userId) {
      positions(first: 1000) { # Assuming a user won't have > 1000 positions
        market {
          id # Market unique key
        }
      }
    }
  }
`;
// --- End Query ---

// --- Query for User Position in a Single Market ---
export const subgraphUserMarketPositionQuery = `
  query GetUserMarketPosition($marketId: ID!, $userId: ID!) {
    positions(
      where: { market: $marketId, account: $userId }
    ) {
      id
      asset {
        id # Token address
      }
      isCollateral
      balance
      side # SUPPLIER, BORROWER, COLLATERAL
    }
  }
`;
// --- End Query ---

export const getSubgraphUserTransactionsQuery = (useMarketFilter: boolean) => {
  // only append this in where if marketIn is defined
  const additionalQuery = useMarketFilter ? 'market_in: $market_in' : '';

  return `
  query GetUserTransactions(
    $userId: ID!
    $first: Int!
    $skip: Int!
    $timestamp_gt: BigInt!
    $timestamp_lt: BigInt!
    ${useMarketFilter ? '$market_in: [Bytes!]}' : ''}
  ) {
    account(id: $userId) {
      deposits(
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
        where: {
          timestamp_gt: $timestamp_gt
          timestamp_lt: $timestamp_lt
          ${additionalQuery}
        }
      ) {
        id
        hash
        timestamp
        isCollateral
        market { id }
        asset { id }
        amount
        shares
        accountActor { id }
      }
      withdraws(
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
        where: {
          timestamp_gt: $timestamp_gt
          timestamp_lt: $timestamp_lt
          ${additionalQuery}
        }
      ) {
        id
        hash
        timestamp
        isCollateral
        market { id }
        asset { id }
        amount
        shares
        accountActor { id }
      }
      borrows(
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
        where: {
          timestamp_gt: $timestamp_gt
          timestamp_lt: $timestamp_lt
          ${additionalQuery}
        }
      ) {
        id
        hash
        timestamp
        market { id }
        asset { id }
        amount
        shares
        accountActor { id }
      }
      repays(
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
        where: {
          timestamp_gt: $timestamp_gt
          timestamp_lt: $timestamp_lt
          ${additionalQuery}
        }
      ) {
        id
        hash
        timestamp
        market { id }
        asset { id }
        amount
        shares
        accountActor { id }
      }
      liquidations(
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
        where: {
          timestamp_gt: $timestamp_gt
          timestamp_lt: $timestamp_lt
          ${additionalQuery}
        }
      ) {
        id
        hash
        timestamp
        market { id }
        liquidator { id }
        amount # Collateral seized
        repaid # Debt repaid
      }
    }
  }
`;
};

export const marketPositionsQuery = `
  query getMarketPositions($market: String!, $minShares: BigInt!, $first: Int!, $skip: Int!) {
    positions(
      where: {
        shares_gt: $minShares
        market: $market
      }
      orderBy: shares
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      shares
      account {
        id
      }
    }
  }
`;

// Query for market suppliers (positions with side: SUPPLIER, isCollateral: false)
export const marketSuppliersQuery = `
  query getMarketSuppliers($market: String!, $minShares: BigInt!, $first: Int!, $skip: Int!) {
    positions(
      where: {
        shares_gt: $minShares
        side: SUPPLIER
        isCollateral: false
        market: $market
      }
      orderBy: shares
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      shares
      account {
        id
      }
    }
  }
`;

// Query for market borrowers (positions with side: BORROWER) including collateral and market totals for conversion
export const marketBorrowersQuery = `
  query getMarketBorrowers($market: String!, $minShares: BigInt!, $first: Int!, $skip: Int!) {
    market(id: $market) {
      totalBorrow
      totalBorrowShares
    }
    positions(
      where: {
        shares_gt: $minShares
        side: BORROWER
        market: $market
      }
      orderBy: shares
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      shares
      account {
        id
        positions(
          where: {
            side: COLLATERAL
            market: $market
          }
        ) {
          balance
        }
      }
    }
  }
`;
