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
  query getMarketDepositsWithdraws($marketId: Bytes!, $loanAssetId: Bytes!) {
    deposits(
      first: 1000, # Subgraph max limit
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId }
    ) {
      amount
      account { id }
      timestamp
      hash
    }
    withdraws(
      first: 1000, # Subgraph max limit
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId }
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
  query getMarketBorrowsRepays($marketId: Bytes!, $loanAssetId: Bytes!) {
    borrows(
      first: 1000,
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId }
    ) {
      amount
      account { id }
      timestamp
      hash
    }
    repays(
      first: 1000,
      orderBy: timestamp,
      orderDirection: desc,
      where: { market: $marketId, asset: $loanAssetId }
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

// Note: The exact field names might need adjustment based on the specific Subgraph schema.
export const subgraphUserTransactionsQuery = `
  query GetUserTransactions(
    $userId: ID!
    $first: Int!
    $skip: Int!
    $timestamp_gt: BigInt! # Always filter from timestamp 0
    $timestamp_lt: BigInt! # Always filter up to current time
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
