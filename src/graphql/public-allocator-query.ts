/**
 * Query for batch-fetching MetaMorpho vaults with their public allocator config,
 * flow caps, and full allocation data in a single request.
 * Used by the Pull Liquidity feature.
 */
export const publicAllocatorVaultsQuery = `
  query getPublicAllocatorVaults($addresses: [String!]!, $chainId: [Int!]!) {
    vaults(where: { address_in: $addresses, chainId_in: $chainId }, first: 100) {
      items {
        address
        name
        symbol
        asset {
          address
          symbol
          decimals
        }
        publicAllocatorConfig {
          fee
          admin
          flowCaps {
            maxIn
            maxOut
            market {
              uniqueKey
            }
          }
        }
        state {
          totalAssets
          allocation {
            market {
              uniqueKey
              loanAsset {
                address
                symbol
                decimals
              }
              collateralAsset {
                address
                symbol
                decimals
              }
              oracle {
                address
              }
              irmAddress
              lltv
              state {
                supplyAssets
                borrowAssets
                liquidityAssets
              }
            }
            supplyAssets
            supplyCap
          }
        }
      }
    }
  }
`;
