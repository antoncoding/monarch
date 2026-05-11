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
