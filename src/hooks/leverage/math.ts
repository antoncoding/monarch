import { LEVERAGE_MAX_MULTIPLIER_BPS, LEVERAGE_MIN_MULTIPLIER_BPS, LEVERAGE_MULTIPLIER_SCALE_BPS } from './types';

export const LEVERAGE_SLIPPAGE_BUFFER_BPS = 9_950n; // 0.50% tolerance
export const LTV_WAD = 10n ** 18n;
export const ORACLE_PRICE_SCALE = 10n ** 36n;

export const clampMultiplierBps = (value: bigint): bigint => {
  if (value < LEVERAGE_MIN_MULTIPLIER_BPS) return LEVERAGE_MIN_MULTIPLIER_BPS;
  if (value > LEVERAGE_MAX_MULTIPLIER_BPS) return LEVERAGE_MAX_MULTIPLIER_BPS;
  return value;
};

export const parseMultiplierToBps = (value: string): bigint => {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) return LEVERAGE_MIN_MULTIPLIER_BPS;

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 1) return LEVERAGE_MIN_MULTIPLIER_BPS;
  return clampMultiplierBps(BigInt(Math.round(parsed * 10_000)));
};

export const formatMultiplierBps = (value: bigint): string => {
  const safe = clampMultiplierBps(value);
  return (Number(safe) / 10_000).toFixed(2);
};

/**
 * Converts user collateral and desired multiplier into extra collateral required
 * via flash liquidity.
 */
export const computeFlashCollateralAmount = (userCollateralAmount: bigint, multiplierBps: bigint): bigint => {
  if (userCollateralAmount <= 0n) return 0n;
  const safeMultiplier = clampMultiplierBps(multiplierBps);
  const leveragedCollateral = (userCollateralAmount * safeMultiplier) / LEVERAGE_MULTIPLIER_SCALE_BPS;
  return leveragedCollateral > userCollateralAmount ? leveragedCollateral - userCollateralAmount : 0n;
};

export const computeProjectedLtv = ({
  currentBorrowAssets,
  borrowDelta,
  currentCollateralAssets,
  collateralDelta,
  oraclePrice,
}: {
  currentBorrowAssets: bigint;
  borrowDelta: bigint;
  currentCollateralAssets: bigint;
  collateralDelta: bigint;
  oraclePrice: bigint;
}): bigint => {
  const projectedBorrowAssets = currentBorrowAssets + borrowDelta;
  const projectedCollateralAssets = currentCollateralAssets + collateralDelta;

  if (projectedBorrowAssets <= 0n) return 0n;
  if (projectedCollateralAssets <= 0n || oraclePrice <= 0n) return 10n ** 30n;

  const collateralValueInLoan = (projectedCollateralAssets * oraclePrice) / ORACLE_PRICE_SCALE;
  if (collateralValueInLoan <= 0n) return 10n ** 30n;

  return (projectedBorrowAssets * LTV_WAD) / collateralValueInLoan;
};

export const withSlippageFloor = (value: bigint): bigint => {
  if (value <= 0n) return 0n;
  const floored = (value * LEVERAGE_SLIPPAGE_BUFFER_BPS) / LEVERAGE_MULTIPLIER_SCALE_BPS;
  return floored > 0n ? floored : 1n;
};

export const withSlippageCeil = (value: bigint): bigint => {
  if (value <= 0n) return 0n;
  const ceilBps = LEVERAGE_MULTIPLIER_SCALE_BPS + (LEVERAGE_MULTIPLIER_SCALE_BPS - LEVERAGE_SLIPPAGE_BUFFER_BPS);
  return (value * ceilBps + LEVERAGE_MULTIPLIER_SCALE_BPS - 1n) / LEVERAGE_MULTIPLIER_SCALE_BPS;
};

export const computeBorrowSharesWithBuffer = ({
  borrowAssets,
  totalBorrowAssets,
  totalBorrowShares,
}: {
  borrowAssets: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
}): bigint => {
  if (borrowAssets <= 0n) return 0n;

  // Morpho virtual shares/assets from SharesMathLib to avoid edge-case division by zero.
  const VIRTUAL_SHARES = 1_000_000n;
  const VIRTUAL_ASSETS = 1n;

  const denominator = totalBorrowAssets + VIRTUAL_ASSETS;
  const numerator = borrowAssets * (totalBorrowShares + VIRTUAL_SHARES);
  const expectedShares = (numerator + denominator - 1n) / denominator; // round up

  // Add 0.5% headroom to keep borrow slippage checks stable across minor state drift.
  return expectedShares + expectedShares / 200n + 1n;
};

export const computeRepaySharesWithBuffer = ({
  repayAssets,
  totalBorrowAssets,
  totalBorrowShares,
}: {
  repayAssets: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
}): bigint => {
  if (repayAssets <= 0n || totalBorrowAssets <= 0n || totalBorrowShares <= 0n) return 0n;

  const expectedShares = (repayAssets * totalBorrowShares) / totalBorrowAssets;
  return expectedShares + expectedShares / 200n + 1n;
};
