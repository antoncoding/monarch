import { parseUnits } from 'viem';

const FEE_DENOMINATOR_PPM = 1_000_000n;
const REBALANCE_FEE_RATE_PPM = 40n; // 0.4 bps = 0.004%
const LEVERAGE_FEE_RATE_PPM = 75n; // 0.75 bps = 0.0075%
export const REBALANCE_FEE_CEILING_USD = 4;
export const LEVERAGE_FEE_CEILING_USD = 5;

type FeeParams = {
  amount: bigint;
  ratePpm: bigint;
  ceilingUsd?: number | null;
  assetPriceUsd?: number | null;
  assetDecimals?: number;
};

type FlowFeeParams = {
  amount: bigint;
  assetPriceUsd?: number | null;
  assetDecimals?: number;
  applyCeiling?: boolean;
};

function computeUsdCeilingInAssetUnits(ceilingUsd: number, assetPriceUsd: number, assetDecimals: number): bigint | null {
  if (!Number.isFinite(ceilingUsd) || ceilingUsd <= 0) return null;
  if (!Number.isFinite(assetPriceUsd) || assetPriceUsd <= 0) return null;
  if (!Number.isInteger(assetDecimals) || assetDecimals < 0) return null;

  const cappedAmountInAsset = ceilingUsd / assetPriceUsd;
  if (!Number.isFinite(cappedAmountInAsset) || cappedAmountInAsset <= 0) return 0n;

  const precision = Math.min(assetDecimals, 18);
  return parseUnits(cappedAmountInAsset.toFixed(precision), assetDecimals);
}

export function getFee({ amount, ratePpm, ceilingUsd, assetPriceUsd, assetDecimals }: FeeParams): bigint {
  if (amount <= 0n || ratePpm <= 0n) return 0n;

  const baseFee = (amount * ratePpm) / FEE_DENOMINATOR_PPM;
  if (baseFee <= 0n) return 0n;

  if (ceilingUsd == null) return baseFee;
  if (assetPriceUsd == null || assetDecimals == null) return baseFee;

  const ceilingInAssetUnits = computeUsdCeilingInAssetUnits(ceilingUsd, assetPriceUsd, assetDecimals);
  if (ceilingInAssetUnits == null) return baseFee;

  return baseFee < ceilingInAssetUnits ? baseFee : ceilingInAssetUnits;
}

export function getRebalanceFee({ amount, assetPriceUsd, assetDecimals, applyCeiling = true }: FlowFeeParams): bigint {
  return getFee({
    amount,
    ratePpm: REBALANCE_FEE_RATE_PPM,
    ceilingUsd: applyCeiling ? REBALANCE_FEE_CEILING_USD : null,
    assetPriceUsd,
    assetDecimals,
  });
}

export function getLeverageFee({ amount, assetPriceUsd, assetDecimals, applyCeiling = true }: FlowFeeParams): bigint {
  return getFee({
    amount,
    ratePpm: LEVERAGE_FEE_RATE_PPM,
    ceilingUsd: applyCeiling ? LEVERAGE_FEE_CEILING_USD : null,
    assetPriceUsd,
    assetDecimals,
  });
}
