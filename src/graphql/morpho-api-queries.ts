const commonMarketFields = `
lltv
uniqueKey
irmAddress
oracle {
  address
}
listed
morphoBlue {
  id
  address
  chain {
    id
  }
}
loanAsset {
  id
  address
  symbol
  name
  decimals
}
collateralAsset {
  id
  address
  symbol
  name
  decimals
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
  apyAtTarget
  rateAtTarget
  dailySupplyApy
  dailyBorrowApy
  weeklySupplyApy
  weeklyBorrowApy
  monthlySupplyApy
  monthlyBorrowApy
}
warnings {
  type
  level
  __typename
}

realizedBadDebt {
  underlying
  usd
}
badDebt {
  underlying
  usd
}

supplyingVaults {
  address
}
`;

export const marketFragment = `
  fragment MarketFields on Market {
    ${commonMarketFields}
  }
`;

export const marketsFragment = `
  fragment MarketFields on Market {
    ${commonMarketFields}
  }
`;

export const marketsQuery = `
  query getMarkets($first: Int, $skip: Int, $where: MarketFilters) {
    markets(first: $first, skip: $skip, where: $where) {
      items {
        ...MarketFields
      }
      pageInfo {
        countTotal
      }
    }
  }
    
  fragment MarketFields on Market {
    lltv
    uniqueKey
    irmAddress
    oracle {
      address
    }
    listed
    morphoBlue {
      address
      chain {
        id
      }
    }
    loanAsset {
      id
      address
      symbol
      name
      decimals
    }
    collateralAsset {
      address
      symbol
      name
      decimals
    }
    realizedBadDebt {
      underlying
    }
    supplyingVaults {
      address
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
      apyAtTarget
      rateAtTarget
    }
    warnings {
      type
      level
    }
  }
`;

export const marketsWhitelistStatusQuery = `
  query getMarketsWhitelistStatus($first: Int, $skip: Int, $where: MarketFilters) {
    markets(first: $first, skip: $skip, where: $where) {
      items {
        uniqueKey
        listed
        morphoBlue {
          chain {
            id
          }
        }
      }
      pageInfo {
        countTotal
      }
    }
  }
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

export const userPositionMarketsQuery = `
  query getUserPositionMarkets($address: String!, $chainIds: [Int!], $first: Int, $skip: Int) {
    marketPositions(
      where: {
        userAddress_in: [$address]
        chainId_in: $chainIds
      }
      first: $first
      skip: $skip
    ) {
      items {
        state {
          supplyShares
          borrowShares
          collateral
        }
        market {
          uniqueKey
          morphoBlue {
            chain {
              id
            }
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
        apyAtTarget(options: $options) {
          x
          y
        }
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
  query getMarketSupplyActivities($uniqueKey: String!, $minAssets: BigInt!,  $first: Int, $skip: Int) {
    transactions (where: {
      marketUniqueKey_in: [$uniqueKey],
      assets_gte: $minAssets,
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
  query getMarketBorrowActivities($uniqueKey: String!, $minAssets: BigInt, $first: Int, $skip: Int) {
    transactions (where: {
      marketUniqueKey_in: [$uniqueKey],
      assets_gte: $minAssets,
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

export const marketSuppliersQuery = `
  query getMarketSuppliers($uniqueKey: String!, $chainId: Int!, $minShares: BigInt, $first: Int, $skip: Int) {
    marketPositions (where: {
      marketUniqueKey_in: [$uniqueKey],
      supplyShares_gte: $minShares,
      chainId_in: [$chainId]
    },
    orderBy: SupplyShares,
    orderDirection: Desc,
    first: $first,
    skip: $skip
    ) {
      items {
        state {
          supplyShares
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

export const marketBorrowersQuery = `
  query getMarketBorrowers($uniqueKey: String!, $chainId: Int!, $minShares: BigInt, $first: Int, $skip: Int) {
    marketPositions (where: {
      marketUniqueKey_in: [$uniqueKey],
      borrowShares_gte: $minShares,
      chainId_in: [$chainId]
    },
    orderBy: BorrowShares,
    orderDirection: Desc,
    first: $first,
    skip: $skip
    ) {
      items {
        state {
          borrowAssets
          collateral
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

export const assetPricesQuery = `
  query getAssetPrices($where: AssetsFilters) {
    assets(where: $where) {
      items {
        address
        symbol
        decimals
        chain {
          id
        }
        priceUsd
      }
    }
  }
`;
