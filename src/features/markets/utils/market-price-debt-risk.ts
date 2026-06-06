import type { MarketMetrics } from '@/hooks/queries/useMarketMetricsQuery';
import { formatUsdValue } from '@/utils/portfolio';
import { WarningCategory, type WarningWithDetail } from '@/utils/types';

export const MARKET_PRICE_BAD_DEBT_WARNING_CODE = 'market_price_bad_debt';

function formatBadDebtRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }

  if (value >= 10) {
    return `${value.toFixed(1)}%`;
  }

  return `${value.toFixed(2)}%`;
}

function formatBorrowerCount(count: number | null): string {
  if (count == null) {
    return 'sampled borrowers';
  }

  return count === 1 ? '1 borrower' : `${count} borrowers`;
}

export function getMarketPriceBadDebtWarning(metrics: MarketMetrics | null | undefined): WarningWithDetail | null {
  if (!metrics) {
    return null;
  }

  const risk = metrics?.marketPriceDebtRisk;
  if (!risk?.hasWarning) {
    return null;
  }

  const badDebtUsd = risk.unrealizedBadDebtUsd ?? 0;
  if (badDebtUsd <= 0) {
    return null;
  }

  const borrowUsd = metrics.currentState?.borrowUsd ?? 0;
  const badDebtRatio = borrowUsd > 0 ? (badDebtUsd / borrowUsd) * 100 : null;
  const debtAtRiskUsd = risk.debtAtRiskUsd ?? badDebtUsd;
  const ratioText = badDebtRatio == null ? '' : ` (${formatBadDebtRatio(badDebtRatio)} of total borrow)`;
  const sourceText = risk.priceSource ? ` Price source: ${risk.priceSource}.` : '';

  return {
    code: MARKET_PRICE_BAD_DEBT_WARNING_CODE,
    level: 'alert',
    description: `Independent market prices imply ${formatUsdValue(badDebtUsd)} bad debt${ratioText}, with ${formatUsdValue(
      debtAtRiskUsd,
    )} debt at risk across ${formatBorrowerCount(risk.borrowerCount)}.${sourceText}`,
    category: WarningCategory.debt,
  };
}
