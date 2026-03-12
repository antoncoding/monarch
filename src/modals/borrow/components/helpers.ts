import { formatUnits } from 'viem';

export const LTV_WAD = 10n ** 18n;
export const ORACLE_PRICE_SCALE = 10n ** 36n;
export const INFINITE_LTV = 10n ** 30n;
const TARGET_LTV_MARGIN_WAD = 10n ** 15n; // 0.1 percentage points
const ORACLE_PRICE_DISPLAY_DECIMALS = 36;
const DEFAULT_PRICE_MIN_FRACTION_DIGITS = 2;
const DEFAULT_PRICE_MAX_FRACTION_DIGITS = 6;
const EDITABLE_PERCENT_REGEX = /^\d*\.?\d*$/;

export const LTV_THRESHOLDS = {
  DANGER: 0.9,
  WARNING: 0.75,
} as const;

type LTVLevel = 'neutral' | 'safe' | 'warning' | 'danger';

const clampNonNegative = (value: bigint): bigint => (value > 0n ? value : 0n);
const divCeil = (numerator: bigint, denominator: bigint): bigint => (denominator > 0n ? (numerator + denominator - 1n) / denominator : 0n);
const getScaleFactor = (decimals: number): bigint => 10n ** BigInt(Math.max(0, decimals));
const trimTrailingZeros = (value: string): string => value.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0*$/u, '');

export const getCollateralValueInLoan = (collateralAssets: bigint, oraclePrice: bigint): bigint => {
  if (collateralAssets <= 0n || oraclePrice <= 0n) return 0n;
  return (collateralAssets * oraclePrice) / ORACLE_PRICE_SCALE;
};

export const scaleMarketOraclePriceForDisplay = ({
  oraclePrice,
  collateralDecimals,
  loanDecimals,
}: {
  oraclePrice: bigint;
  collateralDecimals: number;
  loanDecimals: number;
}): bigint => {
  if (oraclePrice <= 0n) return 0n;
  return (oraclePrice * getScaleFactor(collateralDecimals)) / getScaleFactor(loanDecimals);
};

export const formatMarketOraclePrice = ({
  oraclePrice,
  collateralDecimals,
  loanDecimals,
  minimumFractionDigits = DEFAULT_PRICE_MIN_FRACTION_DIGITS,
  maximumFractionDigits = DEFAULT_PRICE_MAX_FRACTION_DIGITS,
}: {
  oraclePrice: bigint;
  collateralDecimals: number;
  loanDecimals: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  const safeMinimumFractionDigits = Math.max(0, minimumFractionDigits);
  const safeMaximumFractionDigits = Math.max(safeMinimumFractionDigits, maximumFractionDigits);
  const normalizedPrice = scaleMarketOraclePriceForDisplay({
    oraclePrice,
    collateralDecimals,
    loanDecimals,
  });
  const plainDecimalPrice = trimTrailingZeros(formatUnits(normalizedPrice, ORACLE_PRICE_DISPLAY_DECIMALS));
  const numericPrice = Number(plainDecimalPrice);

  if (Number.isFinite(numericPrice)) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: safeMinimumFractionDigits,
      maximumFractionDigits: safeMaximumFractionDigits,
    }).format(numericPrice);
  }

  if (!plainDecimalPrice.includes('.')) return plainDecimalPrice;

  const [integerPart, fractionPart = ''] = plainDecimalPrice.split('.');
  const paddedFraction = fractionPart.padEnd(safeMinimumFractionDigits, '0');
  const cappedFraction = paddedFraction.slice(0, safeMaximumFractionDigits);
  const normalizedFraction =
    cappedFraction.replace(/0+$/u, '').length >= safeMinimumFractionDigits
      ? cappedFraction.replace(/0+$/u, '')
      : paddedFraction.slice(0, safeMinimumFractionDigits);

  return normalizedFraction ? `${integerPart}.${normalizedFraction}` : integerPart;
};

export const computeLtv = ({
  borrowAssets,
  collateralAssets,
  oraclePrice,
}: {
  borrowAssets: bigint;
  collateralAssets: bigint;
  oraclePrice: bigint;
}): bigint => {
  if (borrowAssets <= 0n) return 0n;
  const collateralValueInLoan = getCollateralValueInLoan(collateralAssets, oraclePrice);
  if (collateralValueInLoan <= 0n) return INFINITE_LTV;
  return (borrowAssets * LTV_WAD) / collateralValueInLoan;
};

export const getMaxTargetLtv = (lltv: bigint): bigint => clampNonNegative(lltv - TARGET_LTV_MARGIN_WAD);

export const clampTargetLtv = (targetLtv: bigint, lltv: bigint): bigint => {
  const maxTargetLtv = getMaxTargetLtv(lltv);
  if (targetLtv <= 0n) return 0n;
  if (targetLtv >= maxTargetLtv) return maxTargetLtv;
  return targetLtv;
};

export const ltvWadToPercent = (ltv: bigint): number => Number(ltv) / 1e16;

export const clampEditablePercent = (value: number, maxPercent: number): number => Math.max(0, Math.min(value, maxPercent));

export const formatEditableLtvPercent = (value: number, maxPercent: number): string => {
  const clamped = clampEditablePercent(value, maxPercent);
  if (Number.isInteger(clamped)) return clamped.toString();
  return clamped.toFixed(2).replace(/\.?0+$/, '');
};

export const normalizeEditablePercentInput = (value: string): string | null => {
  const normalizedInput = value.replace(',', '.');
  if (normalizedInput !== '' && !EDITABLE_PERCENT_REGEX.test(normalizedInput)) return null;
  return normalizedInput;
};

export const percentToLtvWad = (percent: number): bigint => {
  if (!Number.isFinite(percent) || percent <= 0) return 0n;
  return BigInt(Math.round(percent * 1e16));
};

export const isInfiniteLtv = (ltv: bigint): boolean => ltv >= INFINITE_LTV;

export const formatLtvPercent = (ltv: bigint, fractionDigits = 2): string =>
  isInfiniteLtv(ltv) ? '∞' : ltvWadToPercent(ltv).toFixed(fractionDigits);

export const computeHealthScoreFromLtv = ({ ltv, lltv }: { ltv: bigint; lltv: bigint }): number | null => {
  if (ltv <= 0n || lltv <= 0n || isInfiniteLtv(ltv)) return null;
  const healthScore = Number(lltv) / Number(ltv);
  return Number.isFinite(healthScore) ? healthScore : null;
};

export const formatHealthScore = (healthScore: number | null, fractionDigits = 2): string => {
  if (healthScore == null || !Number.isFinite(healthScore)) return '—';
  return healthScore.toFixed(fractionDigits);
};

export const computeLiquidationOraclePrice = ({
  oraclePrice,
  ltv,
  lltv,
}: {
  oraclePrice: bigint;
  ltv: bigint;
  lltv: bigint;
}): bigint | null => {
  if (oraclePrice <= 0n || ltv <= 0n || lltv <= 0n) return null;
  return (oraclePrice * ltv) / lltv;
};

export const computeOraclePriceChangePercent = ({
  currentOraclePrice,
  targetOraclePrice,
}: {
  currentOraclePrice: bigint;
  targetOraclePrice: bigint;
}): number | null => {
  if (currentOraclePrice <= 0n || targetOraclePrice < 0n) return null;
  const percentChangeBps = ((currentOraclePrice - targetOraclePrice) * 10_000n) / currentOraclePrice;
  return Number(percentChangeBps) / 100;
};

const formatPercentForDisplay = (value: number): string => value.toFixed(2).replace(/\.?0+$/u, '');

export const formatRelativeLiquidationPriceMove = ({
  percentChange,
  wrapInParentheses = false,
}: {
  percentChange: number | null;
  wrapInParentheses?: boolean;
}): string => {
  if (percentChange == null || !Number.isFinite(percentChange)) {
    return '—';
  }

  const signedValue =
    percentChange > 0
      ? `-${formatPercentForDisplay(percentChange)}%`
      : percentChange < 0
        ? `+${formatPercentForDisplay(Math.abs(percentChange))}%`
        : '0%';

  return wrapInParentheses ? `(${signedValue})` : signedValue;
};

export const formatMarketOraclePriceWithSymbol = ({
  oraclePrice,
  collateralDecimals,
  loanDecimals,
  loanSymbol,
}: {
  oraclePrice: bigint;
  collateralDecimals: number;
  loanDecimals: number;
  loanSymbol: string;
}): string => {
  if (oraclePrice <= 0n) {
    return '—';
  }

  return `${formatMarketOraclePrice({
    oraclePrice,
    collateralDecimals,
    loanDecimals,
  })} ${loanSymbol}`;
};

export const computeRequiredCollateralAssets = ({
  borrowAssets,
  oraclePrice,
  targetLtv,
}: {
  borrowAssets: bigint;
  oraclePrice: bigint;
  targetLtv: bigint;
}): bigint => {
  if (borrowAssets <= 0n || oraclePrice <= 0n || targetLtv <= 0n) return 0n;

  const requiredCollateralValueInLoan = divCeil(borrowAssets * LTV_WAD, targetLtv);
  return divCeil(requiredCollateralValueInLoan * ORACLE_PRICE_SCALE, oraclePrice);
};

export const computeTargetCollateralAmount = ({
  totalBorrowAssets,
  currentCollateralAssets,
  oraclePrice,
  targetLtv,
  maxAdditionalCollateralAssets,
}: {
  totalBorrowAssets: bigint;
  currentCollateralAssets: bigint;
  oraclePrice: bigint;
  targetLtv: bigint;
  maxAdditionalCollateralAssets?: bigint;
}): bigint => {
  const requiredCollateralAssets = computeRequiredCollateralAssets({
    borrowAssets: totalBorrowAssets,
    oraclePrice,
    targetLtv,
  });

  const suggestedAdditionalCollateral = clampNonNegative(requiredCollateralAssets - currentCollateralAssets);
  if (maxAdditionalCollateralAssets == null) return suggestedAdditionalCollateral;
  return suggestedAdditionalCollateral > maxAdditionalCollateralAssets ? maxAdditionalCollateralAssets : suggestedAdditionalCollateral;
};

export const computeTargetRepayAmount = ({
  currentBorrowAssets,
  projectedCollateralAssets,
  oraclePrice,
  targetLtv,
  maxRepayAssets,
}: {
  currentBorrowAssets: bigint;
  projectedCollateralAssets: bigint;
  oraclePrice: bigint;
  targetLtv: bigint;
  maxRepayAssets?: bigint;
}): bigint => {
  const collateralValueInLoan = getCollateralValueInLoan(projectedCollateralAssets, oraclePrice);
  if (currentBorrowAssets <= 0n) return 0n;

  const targetBorrowAfter = collateralValueInLoan > 0n ? (collateralValueInLoan * targetLtv) / LTV_WAD : 0n;
  const suggestedRepay = clampNonNegative(currentBorrowAssets - targetBorrowAfter);

  if (maxRepayAssets == null) return suggestedRepay;
  return suggestedRepay > maxRepayAssets ? maxRepayAssets : suggestedRepay;
};

export const computeTargetWithdrawAmount = ({
  currentCollateralAssets,
  borrowAssetsAfterRepay,
  oraclePrice,
  targetLtv,
  maxWithdrawAssets,
}: {
  currentCollateralAssets: bigint;
  borrowAssetsAfterRepay: bigint;
  oraclePrice: bigint;
  targetLtv: bigint;
  maxWithdrawAssets?: bigint;
}): bigint => {
  const requiredCollateralAssets = computeRequiredCollateralAssets({
    borrowAssets: borrowAssetsAfterRepay,
    oraclePrice,
    targetLtv,
  });

  const suggestedWithdraw = clampNonNegative(currentCollateralAssets - requiredCollateralAssets);
  if (maxWithdrawAssets == null) return suggestedWithdraw;
  return suggestedWithdraw > maxWithdrawAssets ? maxWithdrawAssets : suggestedWithdraw;
};

const getLtvLevel = (ltv: bigint, lltv: bigint): LTVLevel => {
  if (ltv === 0n || lltv <= 0n) return 'neutral';
  const ratio = Number(ltv) / Number(lltv);
  if (ratio >= LTV_THRESHOLDS.DANGER) return 'danger';
  if (ratio >= LTV_THRESHOLDS.WARNING) return 'warning';
  return 'safe';
};

export const getLTVColor = (ltv: bigint, lltv: bigint): string => {
  const level = getLtvLevel(ltv, lltv);
  if (level === 'danger') return 'text-red-500';
  if (level === 'warning') return 'text-orange-400';
  if (level === 'safe') return 'text-emerald-500';
  return 'text-gray-500';
};

export const getLTVProgressColor = (ltv: bigint, lltv: bigint): string => {
  const level = getLtvLevel(ltv, lltv);
  if (level === 'danger') return 'bg-red-500/80';
  if (level === 'warning') return 'bg-orange-400/80';
  if (level === 'safe') return 'bg-emerald-500/80';
  return 'bg-gray-500/80';
};
