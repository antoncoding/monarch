export const feedFieldsFragment = `
  fragment FeedFields on OracleFeed {
    address
    chain {
      id
    }
    description
    id
    pair
    vendor
  }
`;

export const marketFragment = `
  fragment MarketFields on Market {
    id
    lltv
    uniqueKey
    irmAddress
    oracleAddress
    collateralPrice
    whitelisted
    morphoBlue {
      id
      address
      chain {
        id
      }
    }
    oracleInfo {
      type
    }
    loanAsset {
      id
      address
      symbol
      name
      decimals
      priceUsd
    }
    collateralAsset {
      id
      address
      symbol
      name
      decimals
      priceUsd
    }
    state {
      borrowAssets
      supplyAssets
      borrowAssetsUsd
      supplyAssetsUsd
      borrowShares
      supplyShares
      liquidityAssets
      liquidityAssetsUsd
      collateralAssets
      collateralAssetsUsd
      utilization
      supplyApy
      borrowApy
      fee
      timestamp
      rateAtUTarget
      rewards {
        yearlySupplyTokens
        asset {
          address
          priceUsd
          spotPriceEth
        }
        amountPerSuppliedToken
        amountPerBorrowedToken
      }
      monthlySupplyApy
      monthlyBorrowApy
      dailySupplyApy
      dailyBorrowApy
      weeklySupplyApy
      weeklyBorrowApy
    }
    dailyApys {
      netSupplyApy
      netBorrowApy
    }
    warnings {
      type
      level
      __typename
    }
    badDebt {
      underlying
      usd
    }
    realizedBadDebt {
      underlying
      usd
    }
    oracle {
      data {
        ... on MorphoChainlinkOracleData {
          baseFeedOne {
            ...FeedFields
          }
          baseFeedTwo {
            ...FeedFields
          }
          quoteFeedOne {
            ...FeedFields
          }
          quoteFeedTwo {
            ...FeedFields
          }
        }
        ... on MorphoChainlinkOracleV2Data {
          baseFeedOne {
            ...FeedFields
          }
          baseFeedTwo {
            ...FeedFields
          }
          quoteFeedOne {
            ...FeedFields
          }
          quoteFeedTwo {
            ...FeedFields
          }
        }
      }
    }
  }
  ${feedFieldsFragment}
`;

export const marketsQuery = `
  query getMarkets($first: Int, $where: MarketFilters) {
    markets(first: $first, where: $where) {
      items {
        ...MarketFields
      }
      pageInfo {
        countTotal
        count
        limit
        skip
        __typename
      }  
      __typename
    }
  }
  ${marketFragment}
`;

export const userPositionsQuery = `
  query getUserMarketPositions($address: String!, $chainId: Int) {
    userByAddress(address: $address, chainId: $chainId) {
      marketPositions {
        state {
          supplyShares
          supplyAssets
          borrowShares
          borrowAssets
          collateral
          collateralUsd
        }
        market {
          ...MarketFields
        }
      }
      
    }
  }
  ${marketFragment}
`;

export const userPositionForMarketQuery = `
  query getUserMarketPosition($address: String!, $chainId: Int, $marketKey: String!) {
    marketPosition(userAddress: $address, marketUniqueKey: $marketKey, chainId: $chainId){
      state {
        supplyShares
        supplyAssets
        borrowShares
        borrowAssets
        collateral
        collateralUsd
      }
      market {
        ...MarketFields
      }
    }
  }
  ${marketFragment}
`;

export const marketDetailQuery = `
  query getMarketDetail($uniqueKey: String!, $chainId: Int) {
    marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
      ...MarketFields
    }
  }
  ${marketFragment}
`;

export const marketHistoricalDataQuery = `
  query getMarketHistoricalData($uniqueKey: String!, $options: TimeseriesOptions!, $chainId: Int) {
    marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
      historicalState {
        supplyApy(options: $options) {
          x
          y
        }
        borrowApy(options: $options) {
          x
          y
        }
        supplyAssetsUsd(options: $options) {
          x
          y
        }
        borrowAssetsUsd(options: $options) {
          x
          y
        }
        supplyAssets(options: $options) {
          x
          y
        }
        borrowAssets(options: $options) {
          x
          y
        }
        liquidityAssets(options: $options) {
          x
          y
        }
        liquidityAssetsUsd(options: $options) {
          x
          y
        }
        utilization(options: $options) {
          x
          y
        }
        rateAtUTarget(options: $options) {
          x
          y
        }
      }
    }
  }
`;

export const userRebalancerInfoQuery = `
  query UserRebalancerInfo($id: String!) {
    user(id: $id) {
      rebalancer
      marketCaps (where: {cap_gt: 0}) {
        marketId
        cap
      }
      transactions {
        transactionHash
      }
    }
  }
`;

export const userTransactionsQuery = `
  query getUserTransactions($where: TransactionFilters, $first: Int, $skip: Int) {
    transactions(where: $where, first: $first, skip: $skip) {
      items {
        id
        hash
        timestamp
        type
        data {
          __typename
          ... on MarketTransferTransactionData {
            shares
            assets
            market {
              uniqueKey
            }
          }
        }
      }
      pageInfo {
        count
        countTotal
      }
    }
  }
`;

export const marketLiquidationsQuery = `
  query getMarketLiquidations($uniqueKey: String!, $first: Int, $skip: Int) {
  transactions (where: {
    marketUniqueKey_in: [$uniqueKey],
    type_in: [MarketLiquidation]
  },
  first: $first,
  skip: $skip
  ) {
      items {
        hash
        timestamp
        type
        data {
          ... on MarketLiquidationTransactionData {
            repaidAssets
            seizedAssets
            liquidator
            badDebtAssets
          }
        }
      }
      pageInfo {
        countTotal
        count
        limit
        skip
      }
    }   
  }
`;

export const marketSuppliesQuery = `
  query getMarketSupplyActivities($uniqueKey: String!, $first: Int, $skip: Int) {
    transactions (where: {
      marketUniqueKey_in: [$uniqueKey],
      type_in: [MarketSupply, MarketWithdraw]
    },
    first: $first,
    skip: $skip
    ) {
      items {
        type
        hash
        timestamp
        data {
          ... on MarketTransferTransactionData {
            assets
            shares
          }
        }
        user {
          address
        }
      }
      pageInfo {
        countTotal
        count
        limit
        skip
      }
    }   
  }
`;

export const marketBorrowsQuery = `
  query getMarketBorrowActivities($uniqueKey: String!, $first: Int, $skip: Int) {
    transactions (where: {
      marketUniqueKey_in: [$uniqueKey],
      type_in: [MarketBorrow, MarketRepay]
    },
    first: $first,
    skip: $skip
    ) {
      items {
        type
        hash
        timestamp
        data {
          ... on MarketTransferTransactionData {
            assets
            shares
          }
        }
        user {
          address
        }
      }
      pageInfo {
        countTotal
        count
        limit
        skip
      }
    }   
  }
`;
