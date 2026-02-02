'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Address } from 'viem';
import { Card } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useChartColors } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import { chartTooltipCursor } from '@/features/market-detail/components/charts/chart-utils';
import { usePositionHistoryChart, type PositionHistoryDataPoint, type MarketInfo } from '@/hooks/usePositionHistoryChart';
import type { GroupedPosition, UserTransaction } from '@/utils/types';
import type { PositionSnapshot } from '@/utils/positions';
import type { SupportedNetworks } from '@/utils/networks';

// Mode for different display contexts
export type ChartMode = 'detailed' | 'simple';

// Common chart props
type BaseChartProps = {
  mode?: ChartMode;
  height?: number;
  debug?: boolean;
  showHeader?: boolean;
};

// Props for using with GroupedPosition (positions page)
type GroupedPositionChartProps = BaseChartProps & {
  variant: 'grouped';
  groupedPosition: GroupedPosition;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  chainBlockData: Record<number, { block: number; timestamp: number }>;
};

// Props for standalone usage (history page)
type StandaloneChartProps = BaseChartProps & {
  variant: 'standalone';
  chainId: SupportedNetworks;
  loanAssetAddress: Address;
  loanAssetSymbol: string;
  loanAssetDecimals: number;
  startTimestamp: number;
  endTimestamp: number;
  markets: {
    uniqueKey: string;
    collateralSymbol: string;
    collateralAddress: string;
    currentSupplyAssets: string;
  }[];
  transactions: UserTransaction[];
  snapshots: Map<string, PositionSnapshot> | undefined;
};

export type UserPositionsChartProps = GroupedPositionChartProps | StandaloneChartProps;

// Pie chart data type
type PieDataPoint = {
  key: string; // unique market key
  name: string;
  value: number;
  color: string;
  percentage: number;
};

function ChartContent({
  dataPoints,
  markets,
  loanAssetSymbol,
  height,
}: {
  dataPoints: PositionHistoryDataPoint[];
  markets: MarketInfo[];
  loanAssetSymbol: string;
  height: number;
}) {
  const chartColors = useChartColors();

  // Track which data point is being hovered (for synced pie chart)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Build a map of market uniqueKey -> index for consistent color assignment
  // Note: markets from hook already have lowercase uniqueKeys
  const marketColorMap = useMemo(() => {
    const map: Record<string, number> = {};
    markets.forEach((market, index) => {
      map[market.uniqueKey] = index;
    });
    return map;
  }, [markets]);

  // Get color for a market based on its index in the markets array
  const getMarketColor = useCallback(
    (marketKey: string): string => {
      const index = marketColorMap[marketKey] ?? 0;
      return chartColors.pie[index % chartColors.pie.length];
    },
    [marketColorMap, chartColors.pie],
  );

  // Detect duplicate collateral symbols and create display names
  const marketDisplayNames = useMemo(() => {
    const symbolCounts: Record<string, number> = {};

    // First pass: count occurrences
    markets.forEach((market) => {
      symbolCounts[market.collateralSymbol] = (symbolCounts[market.collateralSymbol] || 0) + 1;
    });

    // Second pass: create display names
    const names: Record<string, string> = {};
    markets.forEach((market) => {
      if (symbolCounts[market.collateralSymbol] > 1) {
        // Duplicate symbol - add market key prefix (first 8 chars)
        const keyPrefix = market.uniqueKey.slice(0, 8);
        names[market.uniqueKey] = `${market.collateralSymbol} (${keyPrefix}...)`;
      } else {
        names[market.uniqueKey] = market.collateralSymbol;
      }
    });

    return names;
  }, [markets]);

  // Current data point for pie chart (hovered or latest)
  const currentDataPoint = useMemo(() => {
    if (hoveredIndex !== null && dataPoints[hoveredIndex]) {
      return dataPoints[hoveredIndex];
    }
    return dataPoints.at(-1);
  }, [hoveredIndex, dataPoints]);

  // Pie chart data derived from current data point
  // Keep all markets for consistent height, sort by value descending
  const pieData = useMemo((): PieDataPoint[] => {
    if (!currentDataPoint) return [];

    const total = currentDataPoint.total || 0;
    return markets
      .map((market) => {
        const value = Number(currentDataPoint[market.uniqueKey] ?? 0);
        return {
          key: market.uniqueKey,
          name: marketDisplayNames[market.uniqueKey] || market.collateralSymbol,
          value,
          color: getMarketColor(market.uniqueKey),
          percentage: total > 0 && value > 0 ? (value / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [currentDataPoint, markets, getMarketColor, marketDisplayNames]);

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  // Don't render if no meaningful data
  if (dataPoints.length <= 1 || markets.length === 0) {
    return null;
  }

  const currentTimestamp = currentDataPoint?.timestamp;
  const isHistorical = hoveredIndex !== null && hoveredIndex < dataPoints.length - 1;

  return (
    <Card className="mb-4 overflow-hidden border border-border bg-surface">
      {/* Responsive: stack vertically on mobile, side-by-side on larger screens */}
      <div className="flex flex-col sm:flex-row">
        {/* Stacked Area Chart - Left side */}
        <div className="flex-1 min-w-0">
          <div className="px-4 pt-3 pb-1">
            <h3 className="text-sm font-medium text-secondary">Position History</h3>
          </div>
          <div className="w-full px-2">
            <ResponsiveContainer
              width="100%"
              height={height}
            >
              <AreaChart
                data={dataPoints}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                onMouseMove={(state) => {
                  if (state?.activeTooltipIndex !== undefined) {
                    setHoveredIndex(state.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="var(--color-border)"
                  strokeOpacity={0.25}
                />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="linear"
                  domain={['dataMin', 'dataMax']}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  minTickGap={50}
                  tickFormatter={(time) =>
                    new Date(time * 1000).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatReadable(v)}
                  tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                  width={55}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  cursor={chartTooltipCursor}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;

                    const dataPoint = dataPoints.find((dp) => dp.timestamp === label);
                    const total = dataPoint?.total ?? 0;

                    return (
                      <div className="rounded-md border border-border bg-background px-3 py-2 shadow-lg text-xs">
                        <p className="mb-1.5 text-secondary">
                          {new Date((label ?? 0) * 1000).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <div className="space-y-0.5">
                          {/* Sort by value descending, show only non-zero */}
                          {pieData
                            .filter((entry) => entry.value > 0)
                            .map((entry) => (
                              <div
                                key={entry.key}
                                className="flex items-center justify-between gap-4"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-secondary">{entry.name}</span>
                                </div>
                                <span className="tabular-nums">
                                  {formatReadable(entry.value)} <span className="text-secondary">({entry.percentage.toFixed(1)}%)</span>
                                </span>
                              </div>
                            ))}
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-border/50 flex justify-between font-medium">
                          <span className="text-secondary">Total</span>
                          <span className="tabular-nums">
                            {formatReadable(total)} {loanAssetSymbol}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                {markets.map((market) => {
                  const key = market.uniqueKey;
                  const color = getMarketColor(key);
                  const displayName = marketDisplayNames[key] || market.collateralSymbol;
                  return (
                    <Area
                      key={key}
                      type="stepAfter"
                      dataKey={key}
                      name={displayName}
                      stackId="1"
                      stroke="none"
                      strokeWidth={0}
                      fill={color}
                      fillOpacity={0.6}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Synchronized Pie Chart - Right side on desktop, below on mobile */}
        <div className="w-full sm:w-[180px] flex-shrink-0 border-t sm:border-t-0 sm:border-l border-border/40 flex flex-row sm:flex-col items-center justify-center py-3 px-4 sm:px-0 gap-3 sm:gap-0">
          {/* Mobile: horizontal layout with pie on left, legend on right */}
          {/* Desktop: vertical layout */}
          <div className="flex flex-col items-center">
            <div className="text-center mb-1">
              <p className="text-[10px] text-secondary uppercase tracking-wide">{isHistorical ? 'Historical' : 'Current'}</p>
              {currentTimestamp && <p className="text-xs text-secondary">{formatDate(currentTimestamp)}</p>}
            </div>
            <ResponsiveContainer
              width={120}
              height={120}
            >
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={48}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.color}
                      fillOpacity={0.6}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend - show all markets, dim zero values */}
          <div className="flex-1 sm:flex-none sm:w-full px-2">
            <div className="space-y-0.5">
              {pieData.slice(0, 5).map((entry) => {
                const isZero = entry.value === 0;
                return (
                  <div
                    key={entry.key}
                    className={`flex items-center justify-between text-[10px] ${isZero ? 'opacity-30' : ''}`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="truncate text-secondary">{entry.name}</span>
                    </div>
                    <span className="tabular-nums text-secondary ml-2">{isZero ? '—' : `${entry.percentage.toFixed(1)}%`}</span>
                  </div>
                );
              })}
              {pieData.length > 5 && <p className="text-[10px] text-secondary text-center">+{pieData.length - 5} more</p>}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Extract params from props to normalize between variants
function useChartParams(props: UserPositionsChartProps) {
  return useMemo(() => {
    if (props.variant === 'grouped') {
      const { groupedPosition, transactions, snapshotsByChain, chainBlockData } = props;
      const chainId = groupedPosition.chainId;
      const chainSnapshots = snapshotsByChain[chainId];
      const blockData = chainBlockData[chainId];

      if (!blockData) {
        return null;
      }

      const startTimestamp = blockData.timestamp;
      const endTimestamp = Math.floor(Date.now() / 1000);

      const markets = groupedPosition.markets.map((position) => ({
        uniqueKey: position.market.uniqueKey,
        collateralSymbol: position.market.collateralAsset?.symbol ?? 'Unknown',
        collateralAddress: position.market.collateralAsset?.address ?? '',
        currentSupplyAssets: position.state.supplyAssets,
      }));

      return {
        markets,
        loanAssetDecimals: groupedPosition.loanAssetDecimals,
        loanAssetSymbol: groupedPosition.loanAssetSymbol,
        chainId: chainId as SupportedNetworks,
        startTimestamp,
        endTimestamp,
        transactions,
        snapshots: chainSnapshots,
      };
    }

    // Standalone variant
    return {
      markets: props.markets,
      loanAssetDecimals: props.loanAssetDecimals,
      loanAssetSymbol: props.loanAssetSymbol,
      chainId: props.chainId,
      startTimestamp: props.startTimestamp,
      endTimestamp: props.endTimestamp,
      transactions: props.transactions,
      snapshots: props.snapshots,
    };
  }, [props]);
}

export function UserPositionsChart(props: UserPositionsChartProps) {
  const height = props.height ?? 180;
  const debug = props.debug ?? false;

  const chartParams = useChartParams(props);

  const { dataPoints, markets: marketInfoList } = usePositionHistoryChart({
    markets: chartParams?.markets ?? [],
    loanAssetDecimals: chartParams?.loanAssetDecimals ?? 18,
    chainId: chartParams?.chainId ?? (1 as SupportedNetworks),
    startTimestamp: chartParams?.startTimestamp ?? 0,
    endTimestamp: chartParams?.endTimestamp ?? 0,
    transactions: chartParams?.transactions ?? [],
    snapshots: chartParams?.snapshots,
    debug,
  });

  if (!chartParams) {
    return null;
  }

  return (
    <ChartContent
      dataPoints={dataPoints}
      markets={marketInfoList}
      loanAssetSymbol={chartParams.loanAssetSymbol}
      height={height}
    />
  );
}
