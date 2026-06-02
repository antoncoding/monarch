// Queries for Morpho Vault API
// Reference: https://blue-api.morpho.org/graphql

// Query for fetching listed Morpho vaults across supported chains
export const allVaultsQuery = `
  query AllVaults($first: Int, $where: VaultFilters) {
    vaults(first: $first, where: $where) {
      items {
        address
        chain {
          id
        }
        name
        featured
        metadata {
          description
          image
        }
        state {
          totalAssets
        }
        asset {
          address
          symbol
        }
      }
    }
  }
`;

export const vaultApysQuery = `
  query VaultApys($first: Int, $where: VaultFilters) {
    vaults(first: $first, where: $where) {
      items {
        address
        chain {
          id
        }
        state {
          apy
        }
      }
    }
  }
`;

export const vaultV2SharePriceHistoryQuery = `
  query VaultV2SharePriceHistory($address: String!, $chainId: Int!, $options: TimeseriesOptions!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      historicalState {
        sharePrice(options: $options) {
          x
          y
        }
      }
    }
  }
`;

export const vaultV2MetadataQuery = `
  query VaultV2Metadata($first: Int, $skip: Int, $where: VaultV2sFilters) {
    vaultV2s(first: $first, skip: $skip, where: $where) {
      items {
        address
        chain {
          id
        }
        name
        symbol
        listed
        metadata {
          description
          image
        }
        asset {
          address
          symbol
        }
      }
    }
  }
`;

export const vaultV2RewardsQuery = `
  query VaultV2Rewards($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      apy
      rewards {
        supplyApr
        asset {
          address
          symbol
          price {
            usd
          }
        }
      }
    }
  }
`;
