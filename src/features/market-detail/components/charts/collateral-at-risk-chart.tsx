'use client';

import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { RISK_COLORS } from '@/constants/chartColors';
import { useAllMarketBorrowers } from '@/hooks/useAllMarketPositions';
import { formatReadable } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market, MarketBorrower } from '@/utils/types';
import { ChartGradients, chartTooltipCursor } from './chart-utils';

type CollateralAtRiskChartProps = {
  chainId: SupportedNetworks;
  market: Market;
  oraclePrice: bigint;
};

type RiskBucket = {
  priceDropPercent: number;
  cumulativeDebt: number;
  debtInBucket: number;
};

// Gradient config for the risk chart
const RISK_GRADIENTS = [{ id: 'riskGradient', color: RISK_COLORS.stroke }];

// Price drop buckets from 0% to -100%
const BUCKET_INTERVALS = [0, -5, -10, -15, -20, -25, -30, -35, -40, -45, -50, -55, -60, -65, -70, -75, -80, -85, -90, -95, -100];

/**
 * Calculate the price drop percentage at which a borrower would be liquidated.
 *
 * Liquidation happens when LTV >= LLTV.
 * currentLTV = borrowAssets / (collateral * oraclePrice / 10^36)
 * At liquidation: LLTV = borrowAssets / (collateral * liquidationPrice / 10^36)
 *
 * The price drop percentage is: (currentLTV / LLTV - 1) * 100
 * If currentLTV > LLTV, the position is already liquidatable (return 0).
 */
function calculateLiquidationPriceDropPercent(
  borrowAssets: bigint,
  collateral: bigint,
  oraclePrice: bigint,
  lltv: bigint,
): number {
  if (collateral === 0n || oraclePrice === 0n) return 0; // Already liquidatable

  // Calculate collateral value in loan asset terms
  const collateralValueScaled = collateral * oraclePrice; // Still has 10^36 scale
  if (collateralValueScaled === 0n) return 0;

  // Current LTV = borrowAssets / collateralValue
  // To avoid precision issues, we calculate: currentLTV / LLTV = (borrowAssets * 10^18) / (collateralValue * lltv / 10^36)
  // Simplify: (borrowAssets * 10^18 * 10^36) / (collateral * oraclePrice * lltv)

  const numerator = borrowAssets * BigInt(10 ** 18) * BigInt(10 ** 36);
  const denominator = collateralValueScaled * lltv;

  if (denominator === 0n) return 0;

  // ratio = currentLTV / LLTV
  const ratioScaled = (numerator * BigInt(10000)) / denominator; // Scaled by 10000 for precision
  const ratio = Number(ratioScaled) / 10000;

  // Price drop % = (ratio - 1) * 100
  // If ratio >= 1, position is at or above LLTV (already risky)
  const priceDropPercent = (ratio - 1) * 100;

  // Clamp to [-100, 0] range
  // Negative values mean the price needs to drop that much to liquidate
  // Values > 0 mean already liquidatable
  return Math.max(Math.min(priceDropPercent, 0), -100);
}

/**
 * Aggregate borrowers into risk buckets showing cumulative debt at each price drop level.
 */
function calculateRiskBuckets(
  borrowers: MarketBorrower[],
  oraclePrice: bigint,
  lltv: bigint,
  loanDecimals: number,
): RiskBucket[] {
  // Calculate liquidation price drop for each borrower
  const borrowersWithRisk = borrowers.map((borrower) => {
    const borrowAssets = BigInt(borrower.borrowAssets);
    const collateral = BigInt(borrower.collateral);

    const priceDropPercent = calculateLiquidationPriceDropPercent(borrowAssets, collateral, oraclePrice, lltv);

    const debtValue = Number(formatUnits(borrowAssets, loanDecimals));

    return {
      priceDropPercent,
      debtValue,
    };
  });

  // Sort by price drop (least negative first = closest to liquidation)
  borrowersWithRisk.sort((a, b) => b.priceDropPercent - a.priceDropPercent);

  // Create buckets
  const buckets: RiskBucket[] = [];
  let cumulativeDebt = 0;

  for (const bucket of BUCKET_INTERVALS) {
    // Sum all debt that would be liquidated at this price level or higher
    const debtAtThisLevel = borrowersWithRisk
      .filter((b) => b.priceDropPercent >= bucket)
      .reduce((sum, b) => sum + b.debtValue, 0);

    buckets.push({
      priceDropPercent: bucket,
      cumulativeDebt: debtAtThisLevel,
      debtInBucket: debtAtThisLevel - cumulativeDebt,
    });

    cumulativeDebt = debtAtThisLevel;
  }

  return buckets;
}

export function CollateralAtRiskChart({ chainId, market, oraclePrice }: CollateralAtRiskChartProps) {
  const { data: borrowers, isLoading } = useAllMarketBorrowers(market.uniqueKey, chainId);

  const riskBuckets = useMemo(() => {
    if (!borrowers || borrowers.length === 0 || !oraclePrice || oraclePrice === 0n) return [];

    const lltv = BigInt(market.lltv);
    if (lltv === 0n) return [];

    return calculateRiskBuckets(borrowers, oraclePrice, lltv, market.loanAsset.decimals);
  }, [borrowers, oraclePrice, market]);

  // Calculate key risk metrics
  const riskMetrics = useMemo(() => {
    if (riskBuckets.length === 0) return null;

    const totalDebt = riskBuckets.at(-1)?.cumulativeDebt ?? 0;
    const debtAt10 = riskBuckets.find((b) => b.priceDropPercent === -10)?.cumulativeDebt ?? 0;
    const debtAt25 = riskBuckets.find((b) => b.priceDropPercent === -25)?.cumulativeDebt ?? 0;
    const debtAt50 = riskBuckets.find((b) => b.priceDropPercent === -50)?.cumulativeDebt ?? 0;

    return {
      totalDebt,
      debtAt10,
      debtAt25,
      debtAt50,
      percentAt10: totalDebt > 0 ? (debtAt10 / totalDebt) * 100 : 0,
      percentAt25: totalDebt > 0 ? (debtAt25 / totalDebt) * 100 : 0,
      percentAt50: totalDebt > 0 ? (debtAt50 / totalDebt) * 100 : 0,
    };
  }, [riskBuckets]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: number }) => {
    if (!active || !payload || !payload[0]) return null;

    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-2 text-xs text-secondary">At {label}% price drop</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="text-secondary">Cumulative Debt at Risk</span>
            <span className="tabular-nums">
              {formatReadable(payload[0].value)} {market.loanAsset.symbol}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="flex h-[350px] items-center justify-center border border-border bg-surface">
        <Spinner size={24} />
      </Card>
    );
  }

  if (riskBuckets.length === 0) {
    return (
      <Card className="flex h-[350px] items-center justify-center border border-border bg-surface">
        <p className="text-secondary">No borrower data available</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      <div className="border-b border-border/40 px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-lg text-secondary">Collateral at Risk</h4>
          {riskMetrics && (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-secondary">@-10%:</span>
                <span className="tabular-nums font-medium" style={{ color: riskMetrics.percentAt10 > 10 ? RISK_COLORS.stroke : 'inherit' }}>
                  {formatReadable(riskMetrics.debtAt10)} ({riskMetrics.percentAt10.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-secondary">@-25%:</span>
                <span className="tabular-nums font-medium">
                  {formatReadable(riskMetrics.debtAt25)} ({riskMetrics.percentAt25.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-secondary">@-50%:</span>
                <span className="tabular-nums font-medium">
                  {formatReadable(riskMetrics.debtAt50)} ({riskMetrics.percentAt50.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        <ResponsiveContainer
          width="100%"
          height={280}
        >
          <AreaChart
            data={riskBuckets}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <ChartGradients
              prefix="riskChart"
              gradients={RISK_GRADIENTS}
            />
            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--color-border)"
              strokeOpacity={0.25}
            />
            <XAxis
              dataKey="priceDropPercent"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              ticks={[0, -25, -50, -75, -100]}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatReadable(value)}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              width={60}
            />
            <Tooltip
              cursor={chartTooltipCursor}
              content={<CustomTooltip />}
            />
            <Area
              type="stepAfter"
              dataKey="cumulativeDebt"
              name="Debt at Risk"
              stroke={RISK_COLORS.stroke}
              strokeWidth={2}
              fill="url(#riskChart-riskGradient)"
              fillOpacity={0.7}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-border/40 px-6 py-3">
        <p className="text-xs text-secondary">
          Shows cumulative debt that would become liquidatable at each collateral price drop level. Current LLTV:{' '}
          {(Number(BigInt(market.lltv)) / 1e16).toFixed(0)}%
        </p>
      </div>
    </Card>
  );
}
