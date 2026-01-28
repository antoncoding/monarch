/**
 * Query for fetching a MetaMorpho vault's allocation details,
 * including which markets the vault supplies to and their current state.
 * Used by the Public Allocator reallocate feature.
 */
export const vaultAllocationQuery = `
  query getVaultAllocation($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset {
        address
        symbol
        decimals
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
            oracleAddress
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
`;
