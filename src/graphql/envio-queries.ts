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

export const envioUserPositionForMarketQuery = `
  query EnvioUserPositionForMarket($user: String!, $chainId: Int!, $marketId: String!) {
    Position(
      where: {
        user: { _eq: $user }
        chainId: { _eq: $chainId }
        marketId: { _eq: $marketId }
      }
      limit: 1
    ) {
      marketId
      chainId
      supplyShares
      borrowShares
      collateral
    }
  }
`;

export const buildEnvioUserTransactionsPageQuery = ({
  useHashFilter,
  useMarketFilter,
  useTimestampGte,
  useTimestampLte,
}: {
  useHashFilter: boolean;
  useMarketFilter: boolean;
  useTimestampGte: boolean;
  useTimestampLte: boolean;
}): string => {
  const variableDeclarations = ['$chainId: Int!', '$userAddresses: [String!]!', '$limit: Int!', '$offset: Int!'];

  if (useMarketFilter) {
    variableDeclarations.push('$marketIds: [String!]!');
  }

  if (useTimestampGte) {
    variableDeclarations.push('$timestampGte: numeric!');
  }

  if (useTimestampLte) {
    variableDeclarations.push('$timestampLte: numeric!');
  }

  if (useHashFilter) {
    variableDeclarations.push('$hash: String!');
  }

  const buildWhere = (userField: 'onBehalf' | 'borrower'): string => {
    const whereClauses = ['chainId: { _eq: $chainId }', `${userField}: { _in: $userAddresses }`];

    if (useMarketFilter) {
      whereClauses.push('market_id: { _in: $marketIds }');
    }

    if (useTimestampGte || useTimestampLte) {
      const timestampFilters: string[] = [];

      if (useTimestampGte) {
        timestampFilters.push('_gte: $timestampGte');
      }

      if (useTimestampLte) {
        timestampFilters.push('_lte: $timestampLte');
      }

      whereClauses.push(`timestamp: { ${timestampFilters.join(' ')} }`);
    }

    if (useHashFilter) {
      whereClauses.push('txHash: { _eq: $hash }');
    }

    return whereClauses.join(' ');
  };

  return `
    query EnvioUserTransactionsPage(${variableDeclarations.join(', ')}) {
      supplies: Morpho_Supply(
        where: { ${buildWhere('onBehalf')} }
        limit: $limit
        offset: $offset
        order_by: [{ timestamp: desc }, { txHash: desc }]
      ) {
        txHash
        timestamp
        market_id
        assets
        shares
      }
      withdraws: Morpho_Withdraw(
        where: { ${buildWhere('onBehalf')} }
        limit: $limit
        offset: $offset
        order_by: [{ timestamp: desc }, { txHash: desc }]
      ) {
        txHash
        timestamp
        market_id
        assets
        shares
      }
      borrows: Morpho_Borrow(
        where: { ${buildWhere('onBehalf')} }
        limit: $limit
        offset: $offset
        order_by: [{ timestamp: desc }, { txHash: desc }]
      ) {
        txHash
        timestamp
        market_id
        assets
        shares
      }
      repays: Morpho_Repay(
        where: { ${buildWhere('onBehalf')} }
        limit: $limit
        offset: $offset
        order_by: [{ timestamp: desc }, { txHash: desc }]
      ) {
        txHash
        timestamp
        market_id
        assets
        shares
      }
      supplyCollateral: Morpho_SupplyCollateral(
        where: { ${buildWhere('onBehalf')} }
        limit: $limit
        offset: $offset
        order_by: [{ timestamp: desc }, { txHash: desc }]
      ) {
        txHash
        timestamp
        market_id
        assets
      }
      withdrawCollateral: Morpho_WithdrawCollateral(
        where: { ${buildWhere('onBehalf')} }
        limit: $limit
        offset: $offset
        order_by: [{ timestamp: desc }, { txHash: desc }]
      ) {
        txHash
        timestamp
        market_id
        assets
      }
      liquidations: Morpho_Liquidate(
        where: { ${buildWhere('borrower')} }
        limit: $limit
        offset: $offset
        order_by: [{ timestamp: desc }, { txHash: desc }]
      ) {
        txHash
        timestamp
        market_id
        repaidAssets
      }
    }
  `;
};

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
