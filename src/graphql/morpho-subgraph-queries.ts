export const tokenFragment = `
  fragment TokenFields on Token {
    id # Maps to address
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
    id # Maps to uniqueKey
    lltv
    irm # Maps to irmAddress
    inputToken { # Maps to collateralAsset
      # Fetch full token details now
      ...TokenFields
    }
    inputTokenPriceUSD # Maps to collateralPrice
    borrowedToken { # Maps to loanAsset
      # Fetch full token details now
      ...TokenFields
    }
    totalDepositBalanceUSD # Maps to state.supplyAssetsUsd
    totalBorrowBalanceUSD # Maps to state.borrowAssetsUsd
    totalSupplyShares # Maps to state.supplyShares
    totalBorrowShares # Maps to state.borrowShares
    totalSupply # Add back
    totalBorrow # Add back
    fee # Maps to state.fee

    # --- Restore previously removed fields ---
    name
    isActive
    canBorrowFrom
    canUseAsCollateral
    maximumLTV
    liquidationThreshold
    liquidationPenalty
    createdTimestamp
    createdBlockNumber
    inputTokenBalance # Add back
    variableBorrowedTokenBalance # Add back
    totalValueLockedUSD # Add back
    lastUpdate # Add back
    reserves # Add back
    reserveFactor # Add back
    oracle { # Add back
      ...OracleFields
    }
    rates { # Add back
      id
      rate # APY
      side
      type
    }
    protocol { # Add back
      id # Morpho Blue ID?
      network # Chain ID?
      protocol # Protocol Name (e.g., Morpho Blue)
    }
    # --- End of restored fields ---
  }
  ${tokenFragment} # Restore interpolation
  ${oracleFragment} # Restore interpolation
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