import { formatUnits } from 'viem';
import { LEVERAGE_MAX_MULTIPLIER_BPS, LEVERAGE_MIN_MULTIPLIER_BPS, LEVERAGE_MULTIPLIER_SCALE_BPS } from './types';

export const LEVERAGE_SLIPPAGE_BUFFER_BPS = 9_950n; // 0.50% tolerance
const COMPACT_AMOUNT_LOCALE = 'en-US';
const COMPACT_AMOUNT_MIN_THRESHOLD = 0.000001;
const APY_RATIO_SCALE = 1_000_000_000n;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

const minBigInt = (a: bigint, b: bigint): bigint => (a < b ? a : b);
const floorSub = (value: bigint, subtract: bigint): bigint => (value > subtract ? value - subtract : 0n);
const toScaledRatio = (numerator: bigint, denominator: bigint): number | null => {
  if (denominator <= 0n) return null;
  const scaledRatio = (numerator * APY_RATIO_SCALE) / denominator;
  const ratio = Number(scaledRatio) / Number(APY_RATIO_SCALE);
  return Number.isFinite(ratio) ? ratio : null;
};

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
export const computeLeveragedExtraAmount = (baseAmount: bigint, multiplierBps: bigint): bigint => {
  if (baseAmount <= 0n) return 0n;
  const safeMultiplier = clampMultiplierBps(multiplierBps);
  const leveragedAmount = (baseAmount * safeMultiplier) / LEVERAGE_MULTIPLIER_SCALE_BPS;
  return leveragedAmount > baseAmount ? leveragedAmount - baseAmount : 0n;
};

export const computeFlashCollateralAmount = (userCollateralAmount: bigint, multiplierBps: bigint): bigint => {
  return computeLeveragedExtraAmount(userCollateralAmount, multiplierBps);
};

export const computeLeverageProjectedPosition = ({
  currentBorrowAssets,
  currentCollateralAssets,
  addedBorrowAssets,
  addedCollateralAssets,
}: {
  currentBorrowAssets: bigint;
  currentCollateralAssets: bigint;
  addedBorrowAssets: bigint;
  addedCollateralAssets: bigint;
}): { projectedBorrowAssets: bigint; projectedCollateralAssets: bigint } => ({
  projectedBorrowAssets: currentBorrowAssets + addedBorrowAssets,
  projectedCollateralAssets: currentCollateralAssets + addedCollateralAssets,
});

export type DeleverageProjectedPosition = {
  usesCloseRoute: boolean;
  repayBySharesAmount: bigint;
  flashLoanAmountForTx: bigint;
  autoWithdrawCollateralAmount: bigint;
  projectedCollateralAssets: bigint;
  projectedBorrowAssets: bigint;
  previewDebtRepaid: bigint;
  maxWithdrawCollateral: bigint;
};

export const computeDeleverageProjectedPosition = ({
  currentCollateralAssets,
  currentBorrowAssets,
  currentBorrowShares,
  withdrawCollateralAmount,
  repayAmount,
  maxCollateralForDebtRepay,
  closeRouteAvailable,
  closeBoundIsInputCap,
}: {
  currentCollateralAssets: bigint;
  currentBorrowAssets: bigint;
  currentBorrowShares: bigint;
  withdrawCollateralAmount: bigint;
  repayAmount: bigint;
  maxCollateralForDebtRepay: bigint;
  closeRouteAvailable: boolean;
  closeBoundIsInputCap: boolean;
}): DeleverageProjectedPosition => {
  const maxWithdrawCollateral =
    closeRouteAvailable && closeBoundIsInputCap ? minBigInt(maxCollateralForDebtRepay, currentCollateralAssets) : currentCollateralAssets;
  const boundedWithdrawCollateral = minBigInt(withdrawCollateralAmount, currentCollateralAssets);
  const projectedCollateralAfterInput = floorSub(currentCollateralAssets, boundedWithdrawCollateral);
  const bufferedBorrowAssets = withSlippageCeil(currentBorrowAssets);
  // WHY: full-close execution depends on the dedicated close bound, not the optimistic/pessimistic
  // characteristics of the preview repay leg. This keeps repay-by-shares aligned with the real
  // executable close path and avoids leaving debt dust on swap-backed unwinds.
  const usesCloseRoute =
    closeRouteAvailable &&
    currentBorrowAssets > 0n &&
    currentBorrowShares > 0n &&
    maxCollateralForDebtRepay > 0n &&
    boundedWithdrawCollateral >= maxCollateralForDebtRepay;
  const projectedBorrowAssetsIfPartial = floorSub(currentBorrowAssets, repayAmount);
  const preservesDebtDustPreview = !usesCloseRoute && currentBorrowAssets > 0n && projectedBorrowAssetsIfPartial === 0n && repayAmount > 0n;
  const dustPreservingRepayAmount = preservesDebtDustPreview ? floorSub(currentBorrowAssets, 1n) : repayAmount;
  // WHY: for a 1-unit debt, subtracting one unit would produce a zero flash amount and dead-end the flow.
  // In that edge case we keep the original repay amount so users still have an executable fallback.
  const partialRepayAmountForTx = dustPreservingRepayAmount > 0n ? dustPreservingRepayAmount : repayAmount;
  const repayBySharesAmount = usesCloseRoute ? currentBorrowShares : 0n;
  const flashLoanAmountForTx = usesCloseRoute ? bufferedBorrowAssets : partialRepayAmountForTx;
  const autoWithdrawCollateralAmount = usesCloseRoute ? projectedCollateralAfterInput : 0n;
  const projectedCollateralAssets = usesCloseRoute ? 0n : projectedCollateralAfterInput;
  const projectedBorrowAssets = usesCloseRoute ? 0n : floorSub(currentBorrowAssets, partialRepayAmountForTx);
  const previewDebtRepaid = usesCloseRoute ? currentBorrowAssets : partialRepayAmountForTx;

  return {
    usesCloseRoute,
    repayBySharesAmount,
    flashLoanAmountForTx,
    autoWithdrawCollateralAmount,
    projectedCollateralAssets,
    projectedBorrowAssets,
    previewDebtRepaid,
    maxWithdrawCollateral,
  };
};

export const computeAnnualizedApyFromGrowth = ({
  currentValue,
  pastValue,
  periodSeconds,
}: {
  currentValue: bigint;
  pastValue: bigint;
  periodSeconds: number;
}): number | null => {
  if (currentValue <= 0n || pastValue <= 0n || periodSeconds <= 0) return null;

  const growthRatio = toScaledRatio(currentValue, pastValue);
  if (growthRatio == null || growthRatio <= 0) return null;

  const annualizationFactor = SECONDS_PER_YEAR / periodSeconds;
  const annualizedApy = growthRatio ** annualizationFactor - 1;

  return Number.isFinite(annualizedApy) ? annualizedApy : null;
};

export const convertVaultSharesToUnderlyingAssets = ({
  shares,
  sharePriceInUnderlying,
  oneShareUnit,
}: {
  shares: bigint;
  sharePriceInUnderlying: bigint;
  oneShareUnit: bigint;
}): bigint => {
  if (shares <= 0n || sharePriceInUnderlying <= 0n || oneShareUnit <= 0n) return 0n;
  return (shares * sharePriceInUnderlying) / oneShareUnit;
};

export const computeExpectedNetCarryApy = ({
  collateralShares,
  borrowAssets,
  sharePriceInUnderlying,
  oneShareUnit,
  vaultApy,
  borrowApy,
}: {
  collateralShares: bigint;
  borrowAssets: bigint;
  sharePriceInUnderlying: bigint;
  oneShareUnit: bigint;
  vaultApy: number;
  borrowApy: number;
}): number | null => {
  const collateralUnderlyingAssets = convertVaultSharesToUnderlyingAssets({
    shares: collateralShares,
    sharePriceInUnderlying,
    oneShareUnit,
  });
  if (collateralUnderlyingAssets <= 0n) return null;

  const debtToCollateralRatio = toScaledRatio(borrowAssets, collateralUnderlyingAssets);
  if (debtToCollateralRatio == null) return null;

  const netCarryApy = vaultApy - debtToCollateralRatio * borrowApy;
  return Number.isFinite(netCarryApy) ? netCarryApy : null;
};

export function formatFullTokenAmount(value: bigint, decimals: number): string {
  const formattedUnits = formatUnits(value, decimals);
  const [integerPart, fractionalPart = ''] = formattedUnits.split('.');
  const hasNegativeSign = integerPart.startsWith('-');
  const unsignedIntegerPart = hasNegativeSign ? integerPart.slice(1) : integerPart;
  const groupedIntegerPart = unsignedIntegerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFractionalPart = fractionalPart.replace(/0+$/, '');

  if (trimmedFractionalPart.length > 0) {
    return `${hasNegativeSign ? '-' : ''}${groupedIntegerPart}.${trimmedFractionalPart}`;
  }

  return `${hasNegativeSign ? '-' : ''}${groupedIntegerPart}`;
}

export function formatCompactTokenAmount(value: bigint, decimals: number): string {
  if (value === 0n) return '0';

  const numericValue = Number(formatUnits(value, decimals));
  if (!Number.isFinite(numericValue)) return formatUnits(value, decimals);

  const absoluteValue = Math.abs(numericValue);

  if (absoluteValue >= 1000) {
    return new Intl.NumberFormat(COMPACT_AMOUNT_LOCALE, {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(numericValue);
  }

  if (absoluteValue >= 1) {
    return numericValue.toLocaleString(COMPACT_AMOUNT_LOCALE, {
      maximumFractionDigits: 4,
    });
  }

  if (absoluteValue >= COMPACT_AMOUNT_MIN_THRESHOLD) {
    return numericValue.toLocaleString(COMPACT_AMOUNT_LOCALE, {
      maximumSignificantDigits: 4,
    });
  }

  return `<${COMPACT_AMOUNT_MIN_THRESHOLD}`;
}

export const formatTokenAmountPreview = (value: bigint, decimals: number): { compact: string; full: string } => ({
  compact: formatCompactTokenAmount(value, decimals),
  full: formatFullTokenAmount(value, decimals),
});

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

  const numerator = repayAssets * totalBorrowShares;
  const expectedShares = (numerator + totalBorrowAssets - 1n) / totalBorrowAssets; // round up
  return expectedShares + expectedShares / 200n + 1n;
};
