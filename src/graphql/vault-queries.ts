// Queries for Morpho Vault API
// Reference: https://blue-api.morpho.org/graphql

// Query for fetching all whitelisted Morpho vaults across supported chains
export const allVaultsQuery = `
  query AllVaults($first: Int, $where: VaultFilters) {
    vaults(first: $first, where: $where) {
      items {
        address
        chain {
          id
        }
        name
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
