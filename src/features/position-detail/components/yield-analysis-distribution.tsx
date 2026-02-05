'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { useChartColors } from '@/constants/chartColors';
import { getCollateralColorFromPalette, OTHER_COLOR } from '@/features/positions/utils/colors';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { MarketPositionWithEarnings } from '@/utils/types';

type YieldAnalysisDistributionProps = {
  markets: MarketPositionWithEarnings[];
  periodLabel: string;
};

type PieEntry = {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
  avgBalance?: string;
  isOther?: boolean;
};

const MAX_PIE_ITEMS = 6;

export function YieldAnalysisDistribution({ markets, periodLabel }: YieldAnalysisDistributionProps) {
  const chartColors = useChartColors();

  const pieData = useMemo((): PieEntry[] => {
    const symbolCounts: Record<string, number> = {};
    markets.forEach((position) => {
      const symbol = position.market.collateralAsset?.symbol ?? 'Unknown';
      symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
    });

    const marketDisplayNames: Record<string, string> = {};
    markets.forEach((position) => {
      const symbol = position.market.collateralAsset?.symbol ?? 'Unknown';
      if (symbolCounts[symbol] > 1) {
        const keyPrefix = position.market.uniqueKey.slice(0, 8);
        marketDisplayNames[position.market.uniqueKey] = `${symbol} (${keyPrefix}...)`;
      } else {
        marketDisplayNames[position.market.uniqueKey] = symbol;
      }
    });

    const weighted = markets
      .map((position) => {
        const avgCapital = position.avgCapital ? BigInt(position.avgCapital) : 0n;
        const effectiveTime = position.effectiveTime ?? 0;
        const weightedCapital = avgCapital > 0n && effectiveTime > 0 ? avgCapital * BigInt(effectiveTime) : 0n;
        return {
          position,
          avgCapital,
          weightedCapital,
        };
      })
      .filter((entry) => entry.weightedCapital > 0n)
      .sort((a, b) => (b.weightedCapital > a.weightedCapital ? 1 : b.weightedCapital < a.weightedCapital ? -1 : 0));

    if (weighted.length === 0) return [];

    const totalWeighted = weighted.reduce((sum, entry) => sum + entry.weightedCapital, 0n);
    if (totalWeighted === 0n) return [];

    const toPercent = (value: bigint) => Number((value * 10_000n) / totalWeighted) / 100;

    const entries: PieEntry[] = weighted.map(({ position, avgCapital, weightedCapital }) => {
      const decimals = position.market.loanAsset.decimals;
      const avgBalance = formatReadable(Number(formatBalance(avgCapital, decimals)));
      return {
        key: position.market.uniqueKey,
        label: marketDisplayNames[position.market.uniqueKey] ?? position.market.collateralAsset?.symbol ?? 'Unknown',
        value: toPercent(weightedCapital),
        percentage: toPercent(weightedCapital),
        color: getCollateralColorFromPalette(position.market.uniqueKey.toLowerCase(), chartColors.pie),
        avgBalance: `${avgBalance} ${position.market.loanAsset.symbol ?? ''}`.trim(),
      };
    });

    if (entries.length <= MAX_PIE_ITEMS) return entries;

    const top = entries.slice(0, MAX_PIE_ITEMS - 1);
    const rest = entries.slice(MAX_PIE_ITEMS - 1);
    const otherPct = rest.reduce((sum, entry) => sum + entry.percentage, 0);

    return [
      ...top,
      {
        key: 'other',
        label: 'Other',
        value: otherPct,
        percentage: otherPct,
        color: OTHER_COLOR,
        isOther: true,
      },
    ];
  }, [markets, chartColors.pie]);

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-3">
        <h3 className="font-monospace text-xs uppercase text-secondary">Time-weighted Distribution</h3>
        <span className="text-xs text-secondary">{periodLabel}</span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch">
        <div className="flex-1 min-h-[220px] px-4 py-4">
          {pieData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-secondary">No activity in selected period.</div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={220}
            >
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.color}
                      fillOpacity={0.7}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const entry = payload[0].payload as PieEntry;
                    return (
                      <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-secondary">{entry.percentage.toFixed(2)}% time-weighted share</p>
                        {entry.avgBalance && !entry.isOther && <p className="text-secondary">Avg balance: {entry.avgBalance}</p>}
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="w-full border-t border-border/40 px-4 py-4 sm:w-[280px] sm:border-l sm:border-t-0">
          {pieData.length === 0 ? (
            <div className="text-xs text-secondary">No weighted exposure to display.</div>
          ) : (
            <div className="max-h-[220px] space-y-2 overflow-auto pr-2">
              {pieData.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-secondary">{entry.label}</span>
                  </div>
                  <span className="tabular-nums text-xs text-secondary">{entry.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
