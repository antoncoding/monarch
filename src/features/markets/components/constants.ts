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
  UtilizationRate = 12,
  Trend = 13,
  WeeklySupplyAPY = 14,
  WeeklyBorrowAPY = 15,
  MonthlySupplyAPY = 16,
  MonthlyBorrowAPY = 17,
}

// Gas cost to simplify tx flow: do not need to estimate gas for transactions

export const GAS_COSTS = {
  // direct supply through bundler, no approval
  BUNDLER_SUPPLY: 180_000n,

  // An additional supply through the bundler, already approved
  SINGLE_SUPPLY: 80_000n,

  SINGLE_WITHDRAW: 100_000n,

  // single withdraw + supply
  BUNDLER_REBALANCE: 240_000n,

  // directly borrow from Morpho Blue
  DIRECT_WITHDRAW: 100_000n,
};

// additional multiplier for buffer gas. Rabby uses 1.5
// Using fraction (14/10) to avoid floating-point precision issues with BigInt
export const GAS_MULTIPLIER_NUMERATOR = 14n;
export const GAS_MULTIPLIER_DENOMINATOR = 10n;
