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
import type { Market } from '@/utils/types';
import { ChartGradients, chartTooltipCursor } from './chart-utils';

type CollateralAtRiskChartProps = {
  chainId: SupportedNetworks;
  market: Market;
  oraclePrice: bigint;
};

type RiskDataPoint = {
  priceDrop: number; // 0 to -100
  cumulativeDebt: number; // Absolute debt amount
  cumulativeDebtPercent: number; // Percentage of total debt
};

// Gradient config for the risk chart
const RISK_GRADIENTS = [{ id: 'riskGradient', color: RISK_COLORS.stroke }];

export function CollateralAtRiskChart({ chainId, market, oraclePrice }: CollateralAtRiskChartProps) {
  const { data: borrowers, isLoading } = useAllMarketBorrowers(market.uniqueKey, chainId);

  const lltv = useMemo(() => {
    const lltvBigInt = BigInt(market.lltv);
    return Number(lltvBigInt) / 1e18; // LLTV as decimal (e.g., 0.8 for 80%)
  }, [market.lltv]);

  const { chartData, totalDebt, riskMetrics } = useMemo(() => {
    if (!borrowers || borrowers.length === 0 || !oraclePrice || oraclePrice === 0n || lltv === 0) {
      return { chartData: [], totalDebt: 0, riskMetrics: null };
    }

    // Calculate price drop threshold for each borrower
    const borrowersWithRisk = borrowers
      .map((borrower) => {
        const borrowAssets = BigInt(borrower.borrowAssets);
        const collateral = BigInt(borrower.collateral);

        if (collateral === 0n || borrowAssets === 0n) return null;

        // Calculate collateral value in loan asset terms
        const collateralValueInLoan = (collateral * oraclePrice) / BigInt(10 ** 36);
        if (collateralValueInLoan === 0n) return null;

        // Calculate current LTV as decimal
        const currentLTV = Number(borrowAssets) / Number(collateralValueInLoan);
        const debtValue = Number(formatUnits(borrowAssets, market.loanAsset.decimals));

        // Calculate price drop needed for liquidation
        // Formula: priceDropPercent = 100 * (1 - currentLTV / LLTV)
        // Negative value means price needs to DROP by that percentage
        const priceDropForLiquidation = -100 * (1 - currentLTV / lltv);

        // If currentLTV >= LLTV, priceDropForLiquidation >= 0 (already at/past threshold)
        // Clamp to reasonable range
        const clampedPriceDrop = Math.max(-100, Math.min(0, priceDropForLiquidation));

        return { priceDrop: clampedPriceDrop, debt: debtValue };
      })
      .filter((b): b is { priceDrop: number; debt: number } => b !== null)
      .sort((a, b) => b.priceDrop - a.priceDrop); // Sort by price drop descending (closest to 0 first = most at risk)

    if (borrowersWithRisk.length === 0) {
      return { chartData: [], totalDebt: 0, riskMetrics: null };
    }

    // Calculate total debt
    const total = borrowersWithRisk.reduce((sum, b) => sum + b.debt, 0);

    // Build data points only at actual liquidation thresholds (where debt changes)
    // Get unique price drop thresholds, plus start (0) and end (-100)
    const thresholds = new Set([0, -100, ...borrowersWithRisk.map((b) => Math.round(b.priceDrop))]);
    const sortedThresholds = [...thresholds].sort((a, b) => b - a); // Descending (0 to -100)

    const dataPoints: RiskDataPoint[] = sortedThresholds.map((drop) => {
      const cumulativeDebt = borrowersWithRisk.filter((b) => b.priceDrop >= drop).reduce((sum, b) => sum + b.debt, 0);
      const cumulativeDebtPercent = total > 0 ? (cumulativeDebt / total) * 100 : 0;
      return { priceDrop: drop, cumulativeDebt, cumulativeDebtPercent };
    });

    // Calculate risk metrics for header (percentages) - interpolate from nearest threshold
    const getPercentAtDrop = (targetDrop: number) => {
      const point = dataPoints.find((d) => d.priceDrop <= targetDrop);
      return point?.cumulativeDebtPercent ?? 0;
    };
    const percentAt10 = getPercentAtDrop(-10);
    const percentAt25 = getPercentAtDrop(-25);
    const percentAt50 = getPercentAtDrop(-50);

    return {
      chartData: dataPoints,
      totalDebt: total,
      riskMetrics: {
        percentAt10,
        percentAt25,
        percentAt50,
      },
    };
  }, [borrowers, oraclePrice, market.loanAsset.decimals, lltv]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number; payload: RiskDataPoint }[] }) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;

    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-2 text-xs text-secondary">At {data.priceDrop}% price drop</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="text-secondary">% of Total Debt</span>
            <span className="tabular-nums font-medium">{data.cumulativeDebtPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="text-secondary">Debt at Risk</span>
            <span className="tabular-nums">
              {formatReadable(data.cumulativeDebt)} {market.loanAsset.symbol}
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

  if (chartData.length === 0) {
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
                <span
                  className="tabular-nums font-medium"
                  style={{ color: riskMetrics.percentAt10 > 0 ? RISK_COLORS.stroke : 'inherit' }}
                >
                  {riskMetrics.percentAt10.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-secondary">@-25%:</span>
                <span className="tabular-nums font-medium">{riskMetrics.percentAt25.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-secondary">@-50%:</span>
                <span className="tabular-nums font-medium">{riskMetrics.percentAt50.toFixed(1)}%</span>
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
            data={chartData}
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
              dataKey="priceDrop"
              type="number"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              domain={[-100, 0]}
              ticks={[0, -20, -40, -60, -80, -100]}
              reversed
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              width={50}
              domain={[0, 100]}
            />
            <Tooltip
              cursor={chartTooltipCursor}
              content={<CustomTooltip />}
            />
            <Area
              type="stepAfter"
              dataKey="cumulativeDebtPercent"
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
          Shows cumulative debt at risk if collateral price drops. Total debt: {formatReadable(totalDebt)} {market.loanAsset.symbol}. LLTV:{' '}
          {(lltv * 100).toFixed(0)}%
        </p>
      </div>
    </Card>
  );
}
