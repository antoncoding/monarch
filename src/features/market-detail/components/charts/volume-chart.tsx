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
import {
  TIMEFRAME_LABELS,
  ChartGradients,
  ChartTooltipContent,
  VOLUME_CHART_GRADIENTS,
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

  const toValue = (raw: number | bigint) =>
    volumeView === 'USD' ? Number(raw) : Number(formatUnits(BigInt(raw), market.loanAsset.decimals));

  const getVolumeStats = (type: 'supply' | 'borrow' | 'liquidity') => {
    const data = volumeView === 'USD' ? historicalData?.volumes[`${type}AssetsUsd`] : historicalData?.volumes[`${type}Assets`];
    if (!data || data.length === 0) return { current: 0, netChangePercentage: 0, average: 0 };

    const current = toValue((data.at(-1) as TimeseriesDataPoint).y);
    const start = toValue(data[0].y);
    const netChangePercentage = start !== 0 ? ((current - start) / start) * 100 : 0;
    const average = data.reduce((acc: number, point: TimeseriesDataPoint) => acc + toValue(point.y), 0) / data.length;

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
            onValueChange={(value) => handleTimeframeChange(value as '1d' | '7d' | '30d')}
          >
            <SelectTrigger className="h-8 w-auto min-w-[60px] px-3 text-sm">
              <SelectValue>{TIMEFRAME_LABELS[selectedTimeframe]}</SelectValue>
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
            <AreaChart
              data={getVolumeChartData()}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="volumeChart"
                gradients={VOLUME_CHART_GRADIENTS}
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
