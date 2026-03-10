import { formatUnits } from 'viem';

const USD_TINY_DISPLAY_THRESHOLD = 0.01;
const USD_EXACT_TOOLTIP_FRACTION_DIGITS = 10;

function formatUsd(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);
}

export function computeAssetUsdValue(amount: bigint, assetDecimals: number, assetPriceUsd: number | null): number | null {
  if (amount <= 0n || assetPriceUsd == null || !Number.isFinite(assetPriceUsd) || assetPriceUsd <= 0) {
    return null;
  }

  const assetAmount = Number(formatUnits(amount, assetDecimals));
  if (!Number.isFinite(assetAmount) || assetAmount < 0) {
    return null;
  }

  const usdValue = assetAmount * assetPriceUsd;
  if (!Number.isFinite(usdValue) || usdValue < 0) {
    return null;
  }

  return usdValue;
}

export function formatUsdValueDisplay(usdValue: number): {
  display: string;
  exact: string;
  showExactTooltip: boolean;
} {
  if (usdValue > 0 && usdValue < USD_TINY_DISPLAY_THRESHOLD) {
    return {
      display: '< $0.01',
      exact: formatUsd(usdValue, USD_EXACT_TOOLTIP_FRACTION_DIGITS),
      showExactTooltip: true,
    };
  }

  const exact = formatUsd(usdValue, 6);
  const display = formatUsd(usdValue, usdValue < 1 ? 4 : 2);
  return {
    display,
    exact,
    showExactTooltip: display !== exact,
  };
}
