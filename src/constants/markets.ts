export const DEFAULT_MIN_SUPPLY_USD = 1000;
export const DEFAULT_MIN_LIQUIDITY_USD = 10_000;

// APY values are stored as decimals: 1 = 100%, 15 = 1500%.
// The default lock guard only hides clearly frozen markets with absurd APY.
// ETH-pegged loan markets get a tighter guard because several locked WETH
// markets sit around 200%, which is far below the generic 1500% cutoff but
// still not a useful live market signal.
export const LOCKED_MARKET_APY_THRESHOLDS = {
  default: 15,
  ethPegLoanAsset: 1,
} as const;

export const LOCKED_MARKET_APY_THRESHOLD = LOCKED_MARKET_APY_THRESHOLDS.default;
