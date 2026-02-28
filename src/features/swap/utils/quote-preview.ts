import { formatTokenAmountPreview } from '@/hooks/leverage/math';

const RATE_PREVIEW_DECIMALS = 8;

export const formatSlippagePercent = (value: number): string => {
  return value.toFixed(2).replace(/\.?0+$/, '');
};

export const computeUnitRatePreviewAmount = (
  baseAmount: bigint,
  baseTokenDecimals: number,
  quoteAmount: bigint,
  quoteTokenDecimals: number,
): bigint | null => {
  if (baseAmount <= 0n || quoteAmount <= 0n) return null;

  const scaledNumerator = quoteAmount * 10n ** BigInt(baseTokenDecimals + RATE_PREVIEW_DECIMALS);
  const scaledDenominator = baseAmount * 10n ** BigInt(quoteTokenDecimals);
  if (scaledDenominator <= 0n) return null;

  return scaledNumerator / scaledDenominator;
};

export const formatSwapRatePreview = ({
  baseAmount,
  baseTokenDecimals,
  baseTokenSymbol,
  quoteAmount,
  quoteTokenDecimals,
  quoteTokenSymbol,
}: {
  baseAmount: bigint;
  baseTokenDecimals: number;
  baseTokenSymbol: string;
  quoteAmount: bigint;
  quoteTokenDecimals: number;
  quoteTokenSymbol: string;
}): string | null => {
  const ratePreviewAmount = computeUnitRatePreviewAmount(baseAmount, baseTokenDecimals, quoteAmount, quoteTokenDecimals);
  if (!ratePreviewAmount) return null;

  const formattedRatePreview = formatTokenAmountPreview(ratePreviewAmount, RATE_PREVIEW_DECIMALS).compact;
  return `1 ${baseTokenSymbol} ≈ ${formattedRatePreview} ${quoteTokenSymbol}`;
};
