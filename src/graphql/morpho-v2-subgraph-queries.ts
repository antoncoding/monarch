// GraphQL queries for V2 Vault Factory subgraph

export const userVaultsV2Query = `
  query UserVaultsV2($owner: String!) {
    createVaultV2S(where: {
      owner: $owner
    }) {
      id
      owner
      asset
      newVaultV2
    }
  }
`;