import { useState, useMemo } from 'react';
import moment from 'moment';
import { Card } from '@/components/ui/card';
import { Tooltip as HeroTooltip } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatUnits } from 'viem';
import { Spinner } from '@/components/ui/spinner';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useChartColors } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import { formatChartTime } from '@/utils/chart';
import { useMarketHistoricalData } from '@/hooks/useMarketHistoricalData';
import { useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import {
  TIMEFRAME_LABELS,
  ChartGradients,
  ChartTooltipContent,
  createVolumeChartGradients,
  createLegendClickHandler,
  chartTooltipCursor,
  chartLegendStyle,
} from './chart-utils';
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
  const chartColors = useChartColors();

  const { data: historicalData, isLoading } = useMarketHistoricalData(marketId, chainId, selectedTimeRange);

  const [visibleLines, setVisibleLines] = useState({
    supply: true,
    borrow: true,
    liquidity: true,
  });

  const formatYAxis = (value: number) => {
    if (volumeView === 'USD') {
      return `$${formatReadable(value)}`;
    }
    return formatReadable(value);
  };

  const convertValue = (raw: number | bigint | null): number => {
    const value = raw ?? 0;
    if (volumeView === 'USD') {
      return Number(value);
    }
    return Number(formatUnits(BigInt(value), market.loanAsset.decimals));
  };

  const chartData = useMemo(() => {
    if (!historicalData?.volumes) {
      // Only show current state point in Asset mode (no USD values from market.state)
      if (volumeView === 'Asset') {
        return [
          {
            x: moment().unix(),
            supply: convertValue(BigInt(market.state.supplyAssets ?? 0)),
            borrow: convertValue(BigInt(market.state.borrowAssets ?? 0)),
            liquidity: convertValue(BigInt(market.state.liquidityAssets ?? 0)),
          },
        ];
      }
      return [];
    }

    const supplyData = volumeView === 'USD' ? historicalData.volumes.supplyAssetsUsd : historicalData.volumes.supplyAssets;
    const borrowData = volumeView === 'USD' ? historicalData.volumes.borrowAssetsUsd : historicalData.volumes.borrowAssets;
    const liquidityData = volumeView === 'USD' ? historicalData.volumes.liquidityAssetsUsd : historicalData.volumes.liquidityAssets;

    const historicalPoints = supplyData
      .map((point: TimeseriesDataPoint, index: number) => {
        if (point.y === null || borrowData[index]?.y === null || liquidityData[index]?.y === null) {
          return null;
        }

        const supplyUsdValue = historicalData.volumes.supplyAssetsUsd[index]?.y;
        if (supplyUsdValue !== null && supplyUsdValue >= 100_000_000_000) {
          return null;
        }

        return {
          x: point.x,
          supply: convertValue(point.y),
          borrow: convertValue(borrowData[index]?.y),
          liquidity: convertValue(liquidityData[index]?.y),
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null);

    // Only add "now" point in Asset mode (we don't have USD values from market.state)
    if (volumeView === 'Asset') {
      const nowPoint = {
        x: moment().unix(),
        supply: convertValue(BigInt(market.state.supplyAssets ?? 0)),
        borrow: convertValue(BigInt(market.state.borrowAssets ?? 0)),
        liquidity: convertValue(BigInt(market.state.liquidityAssets ?? 0)),
      };
      return [...historicalPoints, nowPoint];
    }

    return historicalPoints;
  }, [
    historicalData?.volumes,
    volumeView,
    market.loanAsset.decimals,
    market.state.supplyAssets,
    market.state.borrowAssets,
    market.state.liquidityAssets,
  ]);

  const formatValue = (value: number) => {
    const formattedValue = formatReadable(value);
    return volumeView === 'USD' ? `$${formattedValue}` : `${formattedValue} ${market.loanAsset.symbol}`;
  };

  const STATE_KEY_MAP = {
    supply: 'supplyAssets',
    borrow: 'borrowAssets',
    liquidity: 'liquidityAssets',
  } as const;

  const getVolumeStats = (type: 'supply' | 'borrow' | 'liquidity') => {
    // Get current value from market.state (always in asset units)
    const stateKey = STATE_KEY_MAP[type];
    const currentRaw = market.state[stateKey] ?? 0;
    const current = Number(formatUnits(BigInt(currentRaw), market.loanAsset.decimals));

    // Always use asset data for net change calculation (consistent units with current)
    const assetData = historicalData?.volumes[`${type}Assets`];
    if (!assetData || assetData.length === 0) return { current, netChangePercentage: 0, average: 0 };

    const validAssetData = assetData.filter((point: TimeseriesDataPoint) => point.y !== null);
    if (validAssetData.length === 0) return { current, netChangePercentage: 0, average: 0 };

    // Net change percentage: compare asset-to-asset for consistent units
    const startAsset = Number(formatUnits(BigInt(validAssetData[0].y ?? 0), market.loanAsset.decimals));
    const netChangePercentage = startAsset !== 0 ? ((current - startAsset) / startAsset) * 100 : 0;

    // Average: use selected view data (USD or Asset) for display
    const displayData = volumeView === 'USD' ? historicalData?.volumes[`${type}AssetsUsd`] : assetData;
    const validDisplayData = displayData?.filter((point: TimeseriesDataPoint) => point.y !== null) ?? [];
    const average =
      validDisplayData.length > 0
        ? validDisplayData.reduce((acc: number, point: TimeseriesDataPoint) => acc + convertValue(point.y), 0) / validDisplayData.length
        : 0;

    return { current, netChangePercentage, average };
  };

  const legendHandlers = createLegendClickHandler({ visibleLines, setVisibleLines });

  const targetUtilizationData = useMemo(() => {
    const supply = market.state.supplyAssets ? BigInt(market.state.supplyAssets) : 0n;
    const borrow = market.state.borrowAssets ? BigInt(market.state.borrowAssets) : 0n;

    const targetBorrow = (supply * 9n) / 10n;
    const borrowDelta = targetBorrow - borrow;

    const targetSupply = (borrow * 10n) / 9n;
    const supplyDelta = targetSupply - supply;

    return { borrowDelta, supplyDelta };
  }, [market.state.supplyAssets, market.state.borrowAssets]);

  const supplyStats = getVolumeStats('supply');
  const borrowStats = getVolumeStats('borrow');
  const liquidityStats = getVolumeStats('liquidity');

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Live Stats + Controls */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Live Stats */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Supply</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">{formatValue(supplyStats.current)}</span>
              <span className={`text-xs tabular-nums ${supplyStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {supplyStats.netChangePercentage >= 0 ? '+' : ''}
                {supplyStats.netChangePercentage.toFixed(2)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Borrow</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">{formatValue(borrowStats.current)}</span>
              <span className={`text-xs tabular-nums ${borrowStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {borrowStats.netChangePercentage >= 0 ? '+' : ''}
                {borrowStats.netChangePercentage.toFixed(2)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Liquidity</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">{formatValue(liquidityStats.current)}</span>
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
            onValueChange={(value) => setTimeframe(value as '1d' | '7d' | '30d' | '3m' | '6m')}
          >
            <SelectTrigger className="h-8 w-auto min-w-[60px] px-3 text-sm">
              <SelectValue>{TIMEFRAME_LABELS[selectedTimeframe]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1D</SelectItem>
              <SelectItem value="7d">7D</SelectItem>
              <SelectItem value="30d">30D</SelectItem>
              <SelectItem value="3m">3M</SelectItem>
              <SelectItem value="6m">6M</SelectItem>
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
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="volumeChart"
                gradients={createVolumeChartGradients(chartColors)}
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
                cursor={chartTooltipCursor}
                content={({ active, payload, label }) => (
                  <ChartTooltipContent
                    active={active}
                    payload={payload}
                    label={label}
                    formatValue={formatValue}
                  />
                )}
              />
              <Legend
                {...chartLegendStyle}
                {...legendHandlers}
              />
              <Area
                type="monotone"
                dataKey="supply"
                name="Supply"
                stroke={chartColors.supply.stroke}
                strokeWidth={2}
                fill="url(#volumeChart-supplyGradient)"
                fillOpacity={1}
                hide={!visibleLines.supply}
              />
              <Area
                type="monotone"
                dataKey="borrow"
                name="Borrow"
                stroke={chartColors.borrow.stroke}
                strokeWidth={2}
                fill="url(#volumeChart-borrowGradient)"
                fillOpacity={1}
                hide={!visibleLines.borrow}
              />
              <Area
                type="monotone"
                dataKey="liquidity"
                name="Liquidity"
                stroke={chartColors.apyAtTarget.stroke}
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
          <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">{TIMEFRAME_LABELS[selectedTimeframe]} Averages</h4>
          {isLoading ? (
            <div className="flex h-8 items-center">
              <Spinner size={16} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Supply</span>
                <span className="tabular-nums text-sm">{formatValue(supplyStats.average)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Borrow</span>
                <span className="tabular-nums text-sm">{formatValue(borrowStats.average)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Liquidity</span>
                <span className="tabular-nums text-sm">{formatValue(liquidityStats.average)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default VolumeChart;
