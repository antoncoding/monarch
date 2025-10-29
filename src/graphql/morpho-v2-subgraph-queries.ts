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
      adapters(where: {isAdapter: true}) {
        address
      }
    }
  }
`;