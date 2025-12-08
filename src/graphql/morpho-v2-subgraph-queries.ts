// GraphQL queries for V2 Vault Factory subgraph

// Query to fetch only vault addresses by owner
export const userVaultsV2AddressesQuery = `
  query UserVaultsV2Addresses($owner: String!) {
    vaultV2S(where: {
      owner: $owner
    }) {
      id
    }
  }
`;
