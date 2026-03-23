export const envioSuppliersPageQuery = `
  query EnvioSuppliersPage($chainId: Int!, $marketId: String!, $minShares: numeric!, $limit: Int!, $offset: Int!) {
    Position(
      where: {
        chainId: { _eq: $chainId }
        marketId: { _eq: $marketId }
        supplyShares: { _gt: $minShares }
      }
      limit: $limit
      offset: $offset
      order_by: [{ supplyShares: desc }, { user: asc }]
    ) {
      user
      supplyShares
    }
  }
`;

export const envioBorrowersPageQuery = `
  query EnvioBorrowersPage($chainId: Int!, $marketId: String!, $minShares: numeric!, $limit: Int!, $offset: Int!) {
    Position(
      where: {
        chainId: { _eq: $chainId }
        marketId: { _eq: $marketId }
        borrowShares: { _gt: $minShares }
      }
      limit: $limit
      offset: $offset
      order_by: [{ borrowShares: desc }, { user: asc }]
    ) {
      user
      borrowShares
      collateral
    }
  }
`;

export const envioUserPositionsPageQuery = `
  query EnvioUserPositionsPage($user: String!, $chainIds: [Int!], $limit: Int!, $offset: Int!) {
    Position(
      where: {
        user: { _eq: $user }
        chainId: { _in: $chainIds }
      }
      limit: $limit
      offset: $offset
      order_by: [{ chainId: asc }, { marketId: asc }]
    ) {
      marketId
      chainId
      supplyShares
      borrowShares
      collateral
    }
  }
`;

export const envioSupplyWithdrawPageQuery = `
  query EnvioSupplyWithdrawPage($chainId: Int!, $marketId: String!, $minAssets: numeric!, $limit: Int!, $offset: Int!) {
    supplies: Morpho_Supply(
      where: {
        chainId: { _eq: $chainId }
        market_id: { _eq: $marketId }
        assets: { _gt: $minAssets }
      }
      limit: $limit
      offset: $offset
      order_by: [{ timestamp: desc }, { txHash: desc }]
    ) {
      txHash
      timestamp
      assets
      onBehalf
    }
    withdraws: Morpho_Withdraw(
      where: {
        chainId: { _eq: $chainId }
        market_id: { _eq: $marketId }
        assets: { _gt: $minAssets }
      }
      limit: $limit
      offset: $offset
      order_by: [{ timestamp: desc }, { txHash: desc }]
    ) {
      txHash
      timestamp
      assets
      onBehalf
    }
  }
`;

export const envioBorrowRepayPageQuery = `
  query EnvioBorrowRepayPage($chainId: Int!, $marketId: String!, $minAssets: numeric!, $limit: Int!, $offset: Int!) {
    borrows: Morpho_Borrow(
      where: {
        chainId: { _eq: $chainId }
        market_id: { _eq: $marketId }
        assets: { _gt: $minAssets }
      }
      limit: $limit
      offset: $offset
      order_by: [{ timestamp: desc }, { txHash: desc }]
    ) {
      txHash
      timestamp
      assets
      onBehalf
    }
    repays: Morpho_Repay(
      where: {
        chainId: { _eq: $chainId }
        market_id: { _eq: $marketId }
        assets: { _gt: $minAssets }
      }
      limit: $limit
      offset: $offset
      order_by: [{ timestamp: desc }, { txHash: desc }]
    ) {
      txHash
      timestamp
      assets
      onBehalf
    }
  }
`;

export const envioLiquidationsPageQuery = `
  query EnvioLiquidationsPage($chainId: Int!, $marketId: String!, $limit: Int!, $offset: Int!) {
    Morpho_Liquidate(
      where: {
        chainId: { _eq: $chainId }
        market_id: { _eq: $marketId }
      }
      limit: $limit
      offset: $offset
      order_by: [{ timestamp: desc }, { txHash: desc }]
    ) {
      txHash
      timestamp
      caller
      borrower
      repaidAssets
      seizedAssets
      badDebtAssets
    }
  }
`;
