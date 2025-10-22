export const morphoMarketV1AdaptersQuery = `
  query CreateMorphoMarketV1Adapters($parentVault: String!, $morpho: String!) {
    createMorphoMarketV1Adapters(where: { parentVault: $parentVault, morpho: $morpho }) {
      id
      parentVault
      morpho
      morphoMarketV1Adapter
    }
  }
`;
