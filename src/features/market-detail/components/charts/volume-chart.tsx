/* eslint-disable react/no-unstable-nested-components */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Tooltip as HeroTooltip } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatUnits } from 'viem';
import { Spinner } from '@/components/ui/spinner';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { CHART_COLORS } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import { formatChartTime } from '@/utils/chart';
import { useMarketHistoricalData } from '@/hooks/useMarketHistoricalData';
import { useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import type { Market } from '@/utils/types';
import type { TimeseriesDataPoint } from '@/utils/types';

type VolumeChartProps = {
  marketId: string;
  chainId: number;
  market: Market;
};

function VolumeChart({ marketId, chainId, market }: VolumeChartProps) {
  const selectedTimeframe = useMarketDetailChartState((s) => s.selectedTimeframe);
  const selectedTimeRange = useMarketDetailChartState((s) => s.selectedTimeRange);
  const volumeView = useMarketDetailChartState((s) => s.volumeView);
  const setTimeframe = useMarketDetailChartState((s) => s.setTimeframe);
  const setVolumeView = useMarketDetailChartState((s) => s.setVolumeView);

  const { data: historicalData, isLoading } = useMarketHistoricalData(marketId, chainId, selectedTimeRange);

  const [visibleLines, setVisibleLines] = useState({
    supply: true,
    borrow: true,
    liquidity: true,
  });

  const handleTimeframeChange = (timeframe: '1d' | '7d' | '30d') => {
    setTimeframe(timeframe);
  };

  const formatYAxis = (value: number) => {
    if (volumeView === 'USD') {
      return `$${formatReadable(value)}`;
    }
    return formatReadable(value);
  };

  const getVolumeChartData = () => {
    if (!historicalData?.volumes) return [];

    const supplyData = volumeView === 'USD' ? historicalData.volumes.supplyAssetsUsd : historicalData.volumes.supplyAssets;
    const borrowData = volumeView === 'USD' ? historicalData.volumes.borrowAssetsUsd : historicalData.volumes.borrowAssets;
    const liquidityData = volumeView === 'USD' ? historicalData.volumes.liquidityAssetsUsd : historicalData.volumes.liquidityAssets;

    return supplyData
      .map((point: TimeseriesDataPoint, index: number) => {
        const borrowPoint: TimeseriesDataPoint | undefined = borrowData[index];
        const liquidityPoint: TimeseriesDataPoint | undefined = liquidityData[index];

        const supplyValue = volumeView === 'USD' ? point.y : Number(formatUnits(BigInt(point.y), market.loanAsset.decimals));
        const borrowValue =
          volumeView === 'USD' ? borrowPoint?.y || 0 : Number(formatUnits(BigInt(borrowPoint?.y || 0), market.loanAsset.decimals));
        const liquidityValue =
          volumeView === 'USD' ? liquidityPoint?.y || 0 : Number(formatUnits(BigInt(liquidityPoint?.y || 0), market.loanAsset.decimals));

        if (historicalData.volumes.supplyAssetsUsd[index].y >= 100_000_000_000) {
          return null;
        }

        return {
          x: point.x,
          supply: supplyValue,
          borrow: borrowValue,
          liquidity: liquidityValue,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null);
  };

  const formatValue = (value: number) => {
    const formattedValue = formatReadable(value);
    return volumeView === 'USD' ? `$${formattedValue}` : `${formattedValue} ${market.loanAsset.symbol}`;
  };

  const getCurrentVolumeStats = (type: 'supply' | 'borrow' | 'liquidity') => {
    const data = volumeView === 'USD' ? historicalData?.volumes[`${type}AssetsUsd`] : historicalData?.volumes[`${type}Assets`];
    if (!data || data.length === 0) return { current: 0, netChange: 0, netChangePercentage: 0 };

    const current =
      volumeView === 'USD'
        ? (data.at(-1) as TimeseriesDataPoint).y
        : Number(formatUnits(BigInt((data.at(-1) as TimeseriesDataPoint).y), market.loanAsset.decimals));
    const start = volumeView === 'USD' ? data[0].y : Number(formatUnits(BigInt(data[0].y), market.loanAsset.decimals));
    const netChange = current - start;
    const netChangePercentage = start !== 0 ? (netChange / start) * 100 : 0;

    return { current, netChange, netChangePercentage };
  };

  const getAverageVolumeStats = (type: 'supply' | 'borrow' | 'liquidity') => {
    const data = volumeView === 'USD' ? historicalData?.volumes[`${type}AssetsUsd`] : historicalData?.volumes[`${type}Assets`];
    if (!data || data.length === 0) return 0;
    const sum = data.reduce(
      (acc: number, point: TimeseriesDataPoint) =>
        acc + Number(volumeView === 'USD' ? point.y : formatUnits(BigInt(point.y), market.loanAsset.decimals)),
      0,
    );
    return sum / data.length;
  };

  const timeframeLabels: Record<string, string> = {
    '1d': '1D',
    '7d': '7D',
    '30d': '30D',
  };

  const targetUtilizationData = useMemo(() => {
    const supply = market.state.supplyAssets ? BigInt(market.state.supplyAssets) : 0n;
    const borrow = market.state.borrowAssets ? BigInt(market.state.borrowAssets) : 0n;

    const targetBorrow = (supply * 9n) / 10n;
    const borrowDelta = targetBorrow - borrow;

    const targetSupply = (borrow * 10n) / 9n;
    const supplyDelta = targetSupply - supply;

    return { borrowDelta, supplyDelta };
  }, [market.state.supplyAssets, market.state.borrowAssets]);

  const supplyStats = getCurrentVolumeStats('supply');
  const borrowStats = getCurrentVolumeStats('borrow');
  const liquidityStats = getCurrentVolumeStats('liquidity');

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Live Stats + Controls */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Live Stats */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Supply</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">
                {formatValue(supplyStats.current)}
              </span>
              <span className={`text-xs tabular-nums ${supplyStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {supplyStats.netChangePercentage >= 0 ? '+' : ''}
                {supplyStats.netChangePercentage.toFixed(2)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Borrow</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">
                {formatValue(borrowStats.current)}
              </span>
              <span className={`text-xs tabular-nums ${borrowStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {borrowStats.netChangePercentage >= 0 ? '+' : ''}
                {borrowStats.netChangePercentage.toFixed(2)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Liquidity</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">
                {formatValue(liquidityStats.current)}
              </span>
              <span className={`text-xs tabular-nums ${liquidityStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {liquidityStats.netChangePercentage >= 0 ? '+' : ''}
                {liquidityStats.netChangePercentage.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Select
            value={volumeView}
            onValueChange={(value) => setVolumeView(value as 'USD' | 'Asset')}
          >
            <SelectTrigger className="h-8 w-auto min-w-[80px] px-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="Asset">{market.loanAsset.symbol}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={selectedTimeframe}
            onValueChange={(value) => handleTimeframeChange(value as '1d' | '7d' | '30d')}
          >
            <SelectTrigger className="h-8 w-auto min-w-[60px] px-3 text-sm">
              <SelectValue>{timeframeLabels[selectedTimeframe]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1D</SelectItem>
              <SelectItem value="7d">7D</SelectItem>
              <SelectItem value="30d">30D</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart Body - Full Width */}
      <div className="w-full">
        {isLoading ? (
          <div className="flex h-[350px] items-center justify-center text-primary">
            <Spinner size={30} />
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={350}
            id="volume-chart"
          >
            <AreaChart data={getVolumeChartData()} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient
                  id="volumeChart-supplyGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.supply.stroke}
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.supply.stroke}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="volumeChart-borrowGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.borrow.stroke}
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.borrow.stroke}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="volumeChart-liquidityGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.apyAtTarget.stroke}
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.apyAtTarget.stroke}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
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
                tickFormatter={(time) => formatChartTime(time, selectedTimeRange.endTimestamp - selectedTimeRange.startTimestamp)}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={60}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-secondary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
                      <p className="mb-2 text-xs text-secondary">{new Date(label * 1000).toLocaleDateString()}</p>
                      <div className="space-y-1">
                        {payload.map((entry: any) => (
                          <div
                            key={entry.dataKey}
                            className="flex items-center justify-between gap-6 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-secondary">{entry.name}</span>
                            </div>
                            <span className="tabular-nums">{formatValue(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
                onClick={(e) => {
                  const dataKey = e.dataKey as keyof typeof visibleLines;
                  setVisibleLines((prev) => ({
                    ...prev,
                    [dataKey]: !prev[dataKey],
                  }));
                }}
                formatter={(value, entry) => (
                  <span
                    className="text-xs"
                    style={{
                      color: visibleLines[(entry as any).dataKey as keyof typeof visibleLines]
                        ? 'var(--color-text-secondary)'
                        : '#666',
                    }}
                  >
                    {value}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="supply"
                name="Supply"
                stroke={CHART_COLORS.supply.stroke}
                strokeWidth={2}
                fill="url(#volumeChart-supplyGradient)"
                fillOpacity={1}
                hide={!visibleLines.supply}
              />
              <Area
                type="monotone"
                dataKey="borrow"
                name="Borrow"
                stroke={CHART_COLORS.borrow.stroke}
                strokeWidth={2}
                fill="url(#volumeChart-borrowGradient)"
                fillOpacity={1}
                hide={!visibleLines.borrow}
              />
              <Area
                type="monotone"
                dataKey="liquidity"
                name="Liquidity"
                stroke={CHART_COLORS.apyAtTarget.stroke}
                strokeWidth={2}
                fill="url(#volumeChart-liquidityGradient)"
                fillOpacity={1}
                hide={!visibleLines.liquidity}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: IRM Targets + Historical Averages */}
      <div className="grid grid-cols-1 divide-y border-t border-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {/* IRM Targets */}
        <div className="px-6 py-4">
          <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">IRM Rebalancing Targets</h4>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <HeroTooltip
                content={
                  <TooltipContent
                    title="Supply Delta to Target"
                    detail="Supply change needed to reach 90% target utilization (keeping borrow constant)."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary text-sm text-secondary">Supply Δ</span>
              </HeroTooltip>
              <span className="tabular-nums text-sm">
                {formatValue(Number(formatUnits(targetUtilizationData.supplyDelta, market.loanAsset.decimals)))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HeroTooltip
                content={
                  <TooltipContent
                    title="Borrow Delta to Target"
                    detail="Borrow change needed to reach 90% target utilization (keeping supply constant)."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary text-sm text-secondary">Borrow Δ</span>
              </HeroTooltip>
              <span className="tabular-nums text-sm">
                {formatValue(Number(formatUnits(targetUtilizationData.borrowDelta, market.loanAsset.decimals)))}
              </span>
            </div>
          </div>
        </div>

        {/* Historical Averages */}
        <div className="px-6 py-4">
          <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">{timeframeLabels[selectedTimeframe]} Averages</h4>
          {isLoading ? (
            <div className="flex h-8 items-center">
              <Spinner size={16} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Supply</span>
                <span className="tabular-nums text-sm">{formatValue(getAverageVolumeStats('supply'))}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Borrow</span>
                <span className="tabular-nums text-sm">{formatValue(getAverageVolumeStats('borrow'))}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Liquidity</span>
                <span className="tabular-nums text-sm">{formatValue(getAverageVolumeStats('liquidity'))}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default VolumeChart;
