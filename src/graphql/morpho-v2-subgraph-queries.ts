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

export const vaultV2Query = `
  query VaultV2($id: String!) {
    vaultV2(id: $id) {
      id
      asset
      symbol
      name
      curator
      owner
      allocators(where: {isAllocator: true}) {
        account
      }
      sentinels(where: {isSentinel: true}) {
        account
      }
      caps {
        relativeCap
        absoluteCap
        marketId
      }
      totalSupply
      adopters(where: {isAdopter: true}) {
        address
      }
    }
  }
`;