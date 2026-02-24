export const BPS_DENOMINATOR = 10_000n;

// 1.00% buffer for repay-by-shares to absorb stale estimates and interest accrual.
export const REPAY_BY_SHARES_BUFFER_BPS = 100n;

// Absolute floor: 0.001 token units (or 1 unit for low-decimals tokens).
export const REPAY_BY_SHARES_MIN_BUFFER_DECIMALS_OFFSET = 3;
