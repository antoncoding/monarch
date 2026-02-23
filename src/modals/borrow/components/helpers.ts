export const LTV_WAD = 10n ** 18n;
export const ORACLE_PRICE_SCALE = 10n ** 36n;
const TARGET_LTV_MARGIN_WAD = 10n ** 15n; // 0.1 percentage points

export const LTV_THRESHOLDS = {
  DANGER: 0.9,
  WARNING: 0.75,
} as const;

type LTVLevel = 'neutral' | 'safe' | 'warning' | 'danger';

const clampNonNegative = (value: bigint): bigint => (value > 0n ? value : 0n);
const divCeil = (numerator: bigint, denominator: bigint): bigint =>
  denominator > 0n ? (numerator + denominator - 1n) / denominator : 0n;

export const getCollateralValueInLoan = (collateralAssets: bigint, oraclePrice: bigint): bigint => {
  if (collateralAssets <= 0n || oraclePrice <= 0n) return 0n;
  return (collateralAssets * oraclePrice) / ORACLE_PRICE_SCALE;
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
  const collateralValueInLoan = getCollateralValueInLoan(collateralAssets, oraclePrice);
  if (borrowAssets <= 0n || collateralValueInLoan <= 0n) return 0n;
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

export const percentToLtvWad = (percent: number): bigint => {
  if (!Number.isFinite(percent) || percent <= 0) return 0n;
  return BigInt(Math.round(percent * 1e16));
};

export const formatLtvPercent = (ltv: bigint, fractionDigits = 2): string => ltvWadToPercent(ltv).toFixed(fractionDigits);

export const computeTargetBorrowAmount = ({
  currentBorrowAssets,
  projectedCollateralAssets,
  oraclePrice,
  targetLtv,
  maxBorrowAssets,
}: {
  currentBorrowAssets: bigint;
  projectedCollateralAssets: bigint;
  oraclePrice: bigint;
  targetLtv: bigint;
  maxBorrowAssets?: bigint;
}): bigint => {
  const collateralValueInLoan = getCollateralValueInLoan(projectedCollateralAssets, oraclePrice);
  if (collateralValueInLoan <= 0n || targetLtv <= 0n) return 0n;

  const targetBorrowTotal = (collateralValueInLoan * targetLtv) / LTV_WAD;
  const suggestedBorrow = clampNonNegative(targetBorrowTotal - currentBorrowAssets);

  if (maxBorrowAssets == null) return suggestedBorrow;
  return suggestedBorrow > maxBorrowAssets ? maxBorrowAssets : suggestedBorrow;
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
