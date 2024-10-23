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
        supplyShares
        supplyAssets
        supplyAssetsUsd
        borrowShares
        borrowAssets
        borrowAssetsUsd
        market {
          ...MarketFields
        }
      }
      transactions {
        hash
        timestamp
        type
        data {
          __typename
          ... on MarketTransferTransactionData {
            assetsUsd
            shares
            assets
            market {
              id
              uniqueKey
              morphoBlue {
                chain {
                  id
                }
              }
              collateralAsset {
                id
                address
                decimals
              }
              loanAsset {
                id
                address
                decimals
                symbol
              } 
            }
          }
        }
      }
    }
  }
  ${marketFragment}
`;
