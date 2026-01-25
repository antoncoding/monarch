'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { useChartColors } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { ChartGradients, chartTooltipCursor, chartLegendStyle } from '@/features/market-detail/components/charts/chart-utils';
import type { DailyVolume, ChainStats } from '@/hooks/useMonarchTransactions';

type ChainVolumeChartProps = {
  dailyVolumes: DailyVolume[];
  chainStats: ChainStats[];
  isLoading: boolean;
};

// Chain to pie color index mapping (consistent ordering)
const CHAIN_COLOR_INDEX: Record<number, number> = {
  1: 0, // Mainnet
  8453: 1, // Base
  137: 3, // Polygon
  130: 4, // Unichain
  42161: 6, // Arbitrum
  999: 5, // HyperEVM
  143: 2, // Monad
};

export function ChainVolumeChart({ dailyVolumes, chainStats, isLoading }: ChainVolumeChartProps) {
  const chartColors = useChartColors();

  // Get color for a chain using the current palette
  const getChainColor = (chainId: number): string => {
    const index = CHAIN_COLOR_INDEX[chainId] ?? 8;
    return chartColors.pie[index] ?? chartColors.pie[8];
  };

  // Get unique chain IDs from stats
  const chainIds = useMemo(() => chainStats.map((s) => s.chainId), [chainStats]);

  // Track hidden chains instead of visible - all chains visible by default
  const [hiddenChains, setHiddenChains] = useState<Set<number>>(new Set());

  // Derive visible chains (pure computation, no side effects)
  const visibleChains = useMemo(() => {
    const visible: Record<number, boolean> = {};
    for (const chainId of chainIds) {
      visible[chainId] = !hiddenChains.has(chainId);
    }
    return visible;
  }, [chainIds, hiddenChains]);

  const chartData = useMemo(() => {
    return dailyVolumes.map((v) => {
      const dataPoint: Record<string, number> = { x: v.timestamp };
      for (const chainId of chainIds) {
        const chainData = v.byChain[chainId];
        dataPoint[`chain_${chainId}`] = chainData ? chainData.supplyVolumeUsd + chainData.withdrawVolumeUsd : 0;
      }
      return dataPoint;
    });
  }, [dailyVolumes, chainIds]);

  const gradients = useMemo(() => {
    return chainIds.map((chainId) => ({
      id: `chain_${chainId}Gradient`,
      color: getChainColor(chainId),
    }));
  }, [chainIds, chartColors]);

  const formatYAxis = (value: number) => `$${formatReadable(value)}`;

  const handleLegendClick = (e: { dataKey?: unknown }) => {
    if (!e.dataKey || typeof e.dataKey !== 'string') return;
    const chainId = Number(e.dataKey.replace('chain_', ''));
    setHiddenChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        next.delete(chainId);
      } else {
        next.add(chainId);
      }
      return next;
    });
  };

  const legendFormatter = (value: string, entry: { dataKey?: unknown }) => {
    if (!entry.dataKey || typeof entry.dataKey !== 'string') return value;
    const chainId = Number(entry.dataKey.replace('chain_', ''));
    const isVisible = visibleChains[chainId] ?? true;
    return (
      <span
        className="text-xs"
        style={{
          color: isVisible ? 'var(--color-text-secondary)' : '#666',
        }}
      >
        {value}
      </span>
    );
  };

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Chain Stats */}
      <div className="border-b border-border/40 px-6 py-4">
        <h3 className="mb-4 text-sm font-medium">Volume by Chain</h3>
        <div className="flex flex-wrap gap-4">
          {chainStats.map((stat) => {
            const networkImg = getNetworkImg(stat.chainId);
            const networkName = getNetworkName(stat.chainId) ?? `Chain ${stat.chainId}`;
            return (
              <div
                key={stat.chainId}
                className="flex items-center gap-2"
              >
                {networkImg && (
                  <Image
                    src={networkImg as string}
                    alt={networkName}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                )}
                <div>
                  <p className="text-xs text-secondary">{networkName}</p>
                  <p
                    className="tabular-nums text-sm"
                    style={{ color: getChainColor(stat.chainId) }}
                  >
                    ${formatReadable(stat.totalVolumeUsd)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Body */}
      <div className="w-full">
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center text-primary">
            <Spinner size={30} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-secondary">No data available</div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={300}
          >
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="chainVolume"
                gradients={gradients}
              />
              <CartesianGrid
                strokeDasharray="0"
                stroke="var(--color-border)"
                strokeOpacity={0.25}
              />
              <XAxis
                dataKey="x"
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                minTickGap={60}
                tickFormatter={(time) => new Date(time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={70}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
                      <p className="mb-2 text-xs text-secondary">
                        {new Date((label ?? 0) * 1000).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <div className="space-y-1">
                        {payload.map((entry) => {
                          if (!entry.dataKey || typeof entry.dataKey !== 'string') return null;
                          const chainId = Number(entry.dataKey.replace('chain_', ''));
                          const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
                          return (
                            <div
                              key={entry.dataKey}
                              className="flex items-center justify-between gap-6 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-secondary">{networkName}</span>
                              </div>
                              <span className="tabular-nums">${formatReadable(Number(entry.value) || 0)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                {...chartLegendStyle}
                onClick={handleLegendClick}
                formatter={legendFormatter}
              />
              {chainIds.map((chainId) => (
                <Area
                  key={chainId}
                  type="monotone"
                  dataKey={`chain_${chainId}`}
                  name={getNetworkName(chainId) ?? `Chain ${chainId}`}
                  stroke={getChainColor(chainId)}
                  strokeWidth={2}
                  fill={`url(#chainVolume-chain_${chainId}Gradient)`}
                  fillOpacity={visibleChains[chainId] ? 0.3 : 0}
                  strokeOpacity={visibleChains[chainId] ? 1 : 0}
                  hide={!visibleChains[chainId]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
