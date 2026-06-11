'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import ButtonGroup from '@/components/ui/button-group';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChartColors } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import { cn } from '@/utils';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { AdminChartLoadingState } from '@/features/admin-v2/components/admin-chart-loading-state';
import { ChartGradients, chartTooltipCursor, chartLegendStyle } from '@/features/market-detail/components/charts/chart-utils';
import type { DailyVolume, ChainStats } from '@/hooks/useMonarchTransactions';

type ChainVolumeChartProps = {
  dailyVolumes: DailyVolume[];
  chainStats: ChainStats[];
  isLoading: boolean;
};

type ChainChartMode = 'separate' | 'stacked';

// Chain to pie color index mapping (consistent ordering)
const CHAIN_COLOR_INDEX: Record<number, number> = {
  1: 0, // Mainnet
  8453: 1, // Base
  137: 3, // Polygon
  130: 4, // Unichain
  42161: 6, // Arbitrum
  42793: 7, // Etherlink
  999: 5, // HyperEVM
  143: 2, // Monad
};

const CHAIN_STAT_PLACEHOLDERS = ['chain-1', 'chain-2', 'chain-3', 'chain-4'] as const;

export function ChainVolumeChart({ dailyVolumes, chainStats, isLoading }: ChainVolumeChartProps) {
  const chartColors = useChartColors();
  const [chartMode, setChartMode] = useState<ChainChartMode>('separate');

  const chartModeOptions = [
    { key: 'separate', label: 'Separate', value: 'separate' },
    { key: 'stacked', label: 'Stacked', value: 'stacked' },
  ];

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
  const formatPercent = (value: number) => `${value.toFixed(value >= 10 ? 0 : 1)}%`;

  const toggleChainVisibility = (chainId: number) => {
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

  const handleLegendClick = (e: { dataKey?: unknown }) => {
    if (!e.dataKey || typeof e.dataKey !== 'string') return;
    const chainId = Number(e.dataKey.replace('chain_', ''));
    toggleChainVisibility(chainId);
  };

  const legendFormatter = (value: string, entry: { dataKey?: unknown }) => {
    if (!entry.dataKey || typeof entry.dataKey !== 'string') return value;
    const chainId = Number(entry.dataKey.replace('chain_', ''));
    const isVisible = visibleChains[chainId] ?? true;
    return (
      <span
        className="text-xs"
        style={{
          color: 'var(--color-text-secondary)',
          opacity: isVisible ? 1 : 0.45,
        }}
      >
        {value}
      </span>
    );
  };

  return (
    <Card className="overflow-visible border border-border bg-surface shadow-sm">
      {/* Header: Chain Stats */}
      <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-monospace text-xs uppercase text-secondary">Volume by Chain</h3>
          <div className="flex items-center gap-2">
            {hiddenChains.size > 0 && (
              <button
                type="button"
                className="min-h-8 rounded-sm px-2 py-1 text-xs text-secondary transition-colors hover:bg-hovered hover:text-primary"
                onClick={() => setHiddenChains(new Set())}
              >
                Reset chains
              </button>
            )}
            <ButtonGroup
              options={chartModeOptions}
              value={chartMode}
              onChange={(value) => setChartMode(value as ChainChartMode)}
              ariaLabel="Chain chart mode"
              size="sm"
              variant="compact"
            />
          </div>
        </div>
        {isLoading && chainStats.length === 0 ? (
          <div
            className="flex flex-wrap gap-4"
            aria-hidden="true"
          >
            {CHAIN_STAT_PLACEHOLDERS.map((placeholder) => (
              <div
                key={placeholder}
                className="flex min-h-[44px] min-w-[128px] items-center gap-2 rounded-sm border border-transparent px-2.5 py-2"
              >
                <span className="h-5 w-5 rounded-full bg-hovered" />
                <div>
                  <span className="block h-3 w-16 rounded-sm bg-hovered" />
                  <span className="mt-1 block h-4 w-20 rounded-sm bg-hovered" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {chainStats.map((stat) => {
              const networkImg = getNetworkImg(stat.chainId);
              const networkName = getNetworkName(stat.chainId) ?? `Chain ${stat.chainId}`;
              const isVisible = visibleChains[stat.chainId] ?? true;
              return (
                <button
                  key={stat.chainId}
                  type="button"
                  className={cn(
                    'flex min-h-[44px] items-center gap-2 rounded-sm border px-2.5 py-2 text-left transition-colors hover:bg-hovered',
                    isVisible ? 'border-transparent' : 'border-border bg-hovered/40 opacity-50',
                  )}
                  onClick={() => toggleChainVisibility(stat.chainId)}
                  aria-pressed={isVisible}
                  aria-label={isVisible ? `Hide ${networkName}` : `Show ${networkName}`}
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
                    <p className={cn('text-xs text-secondary', !isVisible && 'line-through')}>{networkName}</p>
                    <p
                      className={cn('tabular-nums text-sm', !isVisible && 'line-through')}
                      style={{ color: getChainColor(stat.chainId) }}
                    >
                      ${formatReadable(stat.totalVolumeUsd)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart Body */}
      <div className="relative z-20 w-full overflow-visible">
        {isLoading ? (
          <AdminChartLoadingState className="h-[300px]" />
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
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  const visiblePayload = payload.filter((entry) => typeof entry.value === 'number' && Number(entry.value) > 0);
                  const visibleTotal = visiblePayload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

                  return (
                    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
                      <div className="mb-2 flex items-start justify-between gap-6">
                        <p className="text-xs text-secondary">
                          {new Date((label ?? 0) * 1000).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        {chartMode === 'stacked' && <span className="tabular-nums text-xs">${formatReadable(visibleTotal)}</span>}
                      </div>
                      <div className="space-y-1">
                        {visiblePayload.map((entry) => {
                          if (!entry.dataKey || typeof entry.dataKey !== 'string') return null;
                          const chainId = Number(entry.dataKey.replace('chain_', ''));
                          const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
                          const volume = Number(entry.value) || 0;
                          const percentage = visibleTotal > 0 ? (volume / visibleTotal) * 100 : 0;
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
                              <span className="tabular-nums">
                                ${formatReadable(volume)}
                                {chartMode === 'stacked' ? ` (${formatPercent(percentage)})` : ''}
                              </span>
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
                  fill={chartMode === 'stacked' ? getChainColor(chainId) : `url(#chainVolume-chain_${chainId}Gradient)`}
                  fillOpacity={visibleChains[chainId] ? (chartMode === 'stacked' ? 0.55 : 0.3) : 0}
                  strokeOpacity={visibleChains[chainId] ? 1 : 0}
                  hide={!visibleChains[chainId]}
                  stackId={chartMode === 'stacked' ? 'chainVolume' : undefined}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
