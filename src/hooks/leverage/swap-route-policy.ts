// Observed on Base USDC -> cbBTC: ParaSwap's Native route returned a decimal-inconsistent
// collateral amount, collapsed the leverage preview LTV, and reverted when executed by the adapter.
// Keep the exclusion scoped to swap-backed leverage/deleverage loops; generic swaps can still use
// ParaSwap's default routing.
export const LEVERAGE_SWAP_EXCLUDED_DEXS = ['Native'] as const;
export const LEVERAGE_SWAP_ROUTE_POLICY_KEY = `exclude:${LEVERAGE_SWAP_EXCLUDED_DEXS.join(',')}`;
