/**
 * Application identifier for Velora integration
 */
export const SWAP_PARTNER = 'monarchlend';

/**
 * Velora API base URL
 */
export const VELORA_API_BASE_URL = 'https://api.paraswap.io';

/**
 * Velora API version for price quote endpoint
 */
export const VELORA_PRICES_API_VERSION = '6.2';

/**
 * Default slippage tolerance as a percentage (0.5 = 0.5%)
 */
export const DEFAULT_SLIPPAGE_PERCENT = 0.5;

/**
 * Slippage tolerance input bounds as percentages.
 *
 * ParaSwap accepts fractional BPS values for RFQ routes, so the UI allows
 * sub-0.01% tolerances for stable pairs while keeping a positive floor.
 */
export const MIN_SLIPPAGE_PERCENT = 0.001;
export const MAX_SLIPPAGE_PERCENT = 5;

export const clampSlippagePercent = (value: number): number => {
  return Math.min(MAX_SLIPPAGE_PERCENT, Math.max(MIN_SLIPPAGE_PERCENT, value));
};

export const slippagePercentToBps = (value: number): number => {
  return Number((clampSlippagePercent(value) * 100).toFixed(6));
};
