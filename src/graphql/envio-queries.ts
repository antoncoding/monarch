export const envioMarketsQuery = `
  query EnvioMarkets($limit: Int!, $offset: Int!, $where: Market_bool_exp) {
    Market(limit: $limit, offset: $offset, where: $where, order_by: [{ chainId: asc }, { marketId: asc }]) {
      chainId
      marketId
      loanToken
      collateralToken
      oracle
      irm
      lltv
      fee
      lastUpdate
      rateAtTarget
      totalSupplyAssets
      totalSupplyShares
      totalBorrowAssets
      totalBorrowShares
    }
  }
`;

export const envioMarketQuery = `
  query EnvioMarket($chainId: Int!, $marketId: String!) {
    Market(
      limit: 1
      where: {
        chainId: { _eq: $chainId }
        marketId: { _eq: $marketId }
      }
    ) {
      chainId
      marketId
      loanToken
      collateralToken
      oracle
      irm
      lltv
      fee
      lastUpdate
      rateAtTarget
      totalSupplyAssets
      totalSupplyShares
      totalBorrowAssets
      totalBorrowShares
    }
  }
`;

export const envioPositionsQuery = `
  query EnvioPositions($limit: Int!, $offset: Int!, $where: Position_bool_exp) {
    Position(limit: $limit, offset: $offset, where: $where, order_by: [{ chainId: asc }, { marketId: asc }]) {
      chainId
      marketId
      supplyShares
      borrowShares
      collateral
      user
    }
  }
`;

export const envioPositionForMarketQuery = `
  query EnvioPositionForMarket($chainId: Int!, $marketId: String!, $user: String!) {
    Position(
      limit: 1
      where: {
        chainId: { _eq: $chainId }
        marketId: { _eq: $marketId }
        user: { _eq: $user }
      }
    ) {
      chainId
      marketId
      supplyShares
      borrowShares
      collateral
      user
    }
  }
`;

export const envioMarketSuppliersQuery = `
  query EnvioMarketSuppliers($limit: Int!, $offset: Int!, $where: Position_bool_exp) {
    Position(limit: $limit, offset: $offset, where: $where, order_by: [{ supplyShares: desc }, { user: asc }]) {
      chainId
      marketId
      supplyShares
      user
    }
  }
`;

export const envioMarketSuppliersCountQuery = `
  query EnvioMarketSuppliersCount($where: Position_bool_exp) {
    Position_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export const envioMarketBorrowersQuery = `
  query EnvioMarketBorrowers($limit: Int!, $offset: Int!, $where: Position_bool_exp) {
    Position(limit: $limit, offset: $offset, where: $where, order_by: [{ borrowShares: desc }, { user: asc }]) {
      chainId
      marketId
      borrowShares
      collateral
      user
    }
  }
`;

export const envioMarketBorrowersCountQuery = `
  query EnvioMarketBorrowersCount($where: Position_bool_exp) {
    Position_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export const envioSupplyEventsQuery = `
  query EnvioSupplyEvents($limit: Int!, $offset: Int!, $where: Morpho_Supply_bool_exp) {
    Morpho_Supply(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: desc }, { id: desc }]) {
      assets
      chainId
      market_id
      onBehalf
      shares
      timestamp
      txHash
    }
  }
`;

export const envioWithdrawEventsQuery = `
  query EnvioWithdrawEvents($limit: Int!, $offset: Int!, $where: Morpho_Withdraw_bool_exp) {
    Morpho_Withdraw(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: desc }, { id: desc }]) {
      assets
      chainId
      market_id
      onBehalf
      receiver
      shares
      timestamp
      txHash
    }
  }
`;

export const envioBorrowEventsQuery = `
  query EnvioBorrowEvents($limit: Int!, $offset: Int!, $where: Morpho_Borrow_bool_exp) {
    Morpho_Borrow(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: desc }, { id: desc }]) {
      assets
      chainId
      market_id
      onBehalf
      receiver
      shares
      timestamp
      txHash
    }
  }
`;

export const envioRepayEventsQuery = `
  query EnvioRepayEvents($limit: Int!, $offset: Int!, $where: Morpho_Repay_bool_exp) {
    Morpho_Repay(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: desc }, { id: desc }]) {
      assets
      chainId
      market_id
      onBehalf
      shares
      timestamp
      txHash
    }
  }
`;

export const envioSupplyCollateralEventsQuery = `
  query EnvioSupplyCollateralEvents($limit: Int!, $offset: Int!, $where: Morpho_SupplyCollateral_bool_exp) {
    Morpho_SupplyCollateral(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: desc }, { id: desc }]) {
      assets
      chainId
      market_id
      onBehalf
      timestamp
      txHash
    }
  }
`;

export const envioWithdrawCollateralEventsQuery = `
  query EnvioWithdrawCollateralEvents($limit: Int!, $offset: Int!, $where: Morpho_WithdrawCollateral_bool_exp) {
    Morpho_WithdrawCollateral(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: desc }, { id: desc }]) {
      assets
      chainId
      market_id
      onBehalf
      receiver
      timestamp
      txHash
    }
  }
`;

export const envioLiquidationsQuery = `
  query EnvioLiquidations($limit: Int!, $offset: Int!, $where: Morpho_Liquidate_bool_exp) {
    Morpho_Liquidate(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: desc }, { id: desc }]) {
      badDebtAssets
      borrower
      caller
      chainId
      market_id
      repaidAssets
      repaidShares
      seizedAssets
      timestamp
      txHash
    }
  }
`;

export const envioBorrowRateUpdatesQuery = `
  query EnvioBorrowRateUpdates($limit: Int!, $offset: Int!, $where: AdaptiveCurveIrm_BorrowRateUpdate_bool_exp) {
    AdaptiveCurveIrm_BorrowRateUpdate(limit: $limit, offset: $offset, where: $where, order_by: [{ timestamp: asc }, { id: asc }]) {
      avgBorrowRate
      chainId
      market_id
      rateAtTarget
      timestamp
      txHash
    }
  }
`;

export const envioLatestBorrowRateUpdateBeforeQuery = `
  query EnvioLatestBorrowRateUpdateBefore($chainId: Int!, $marketId: String!, $timestampLte: BigInt!) {
    AdaptiveCurveIrm_BorrowRateUpdate(
      limit: 1
      where: {
        chainId: { _eq: $chainId }
        market_id: { _eq: $marketId }
        timestamp: { _lte: $timestampLte }
      }
      order_by: [{ timestamp: desc }, { id: desc }]
    ) {
      avgBorrowRate
      chainId
      market_id
      rateAtTarget
      timestamp
      txHash
    }
  }
`;
