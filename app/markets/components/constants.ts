export enum SortColumn {
  Starred = 0,
  LoanAsset = 1,
  CollateralAsset = 2,
  LLTV = 3,
  Supply = 5,
  Borrow = 6,
  SupplyAPY = 7,
  Liquidity = 8,
  BorrowAPY = 9,
  RateAtTarget = 10,
  TrustedBy = 11,
}

// Gas cost to simplify tx flow: do not need to estimate gas for transactions

export const GAS_COSTS = {
  // direct supply through bundler, no approval
  BUNDLER_SUPPLY: 180000,

  // An additional supply through the bundler, already approved
  SINGLE_SUPPLY: 80000,

  SINGLE_WITHDRAW: 100000,

  // single withdraw + supply
  BUNDLER_REBALANCE: 240000,

  // directly borrow from Morpho Blue
  DIRECT_WITHDRAW: 100000,
};

// additional multiplier for buffer gas. Rabby uses 1.5
export const GAS_MULTIPLIER = 1.4;
