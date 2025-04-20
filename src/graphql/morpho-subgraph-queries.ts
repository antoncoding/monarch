export const tokenFragment = `
  fragment TokenFields on Token {
    id # address
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
    id # uniqueKey
    lltv
    irm # irmAddress
    inputToken { # collateralAsset
      ...TokenFields
    }
    inputTokenPriceUSD # collateralPrice
    borrowedToken { # loanAsset
      ...TokenFields
    }
    totalDepositBalanceUSD # supplyAssetsUsd
    totalBorrowBalanceUSD # borrowAssetsUsd
    totalSupplyShares # supplyShares
    totalBorrowShares # borrowShares
    totalSupply # supplyAssets
    totalBorrow # borrowAssets
    fee # fee

    name
    isActive
    canBorrowFrom
    canUseAsCollateral
    maximumLTV
    liquidationThreshold
    liquidationPenalty
    createdTimestamp
    createdBlockNumber
    inputTokenBalance # collateralAssets
    variableBorrowedTokenBalance
    totalValueLockedUSD # collateralAssetsUsd?
    lastUpdate # timestamp
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
      id # Morpho Blue Address?
      network # Chain Name
      protocol # Protocol Name
    }
  }
  ${tokenFragment}
  ${oracleFragment}
`;

export const marketsQuery = `
  query getSubgraphMarkets($first: Int, $where: Market_filter) {
    markets(first: $first, where: $where, orderBy: totalValueLockedUSD, orderDirection: desc) {
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