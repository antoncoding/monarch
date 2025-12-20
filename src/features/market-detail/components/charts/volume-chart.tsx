/* eslint-disable react/no-unstable-nested-components */

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Tooltip as HeroTooltip } from '@/components/ui/tooltip';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatUnits } from 'viem';
import { HiOutlineInformationCircle } from 'react-icons/hi2';
import ButtonGroup from '@/components/ui/button-group';
import { Spinner } from '@/components/ui/spinner';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { CHART_COLORS } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import type { MarketVolumes } from '@/utils/types';
import type { TimeseriesDataPoint, Market, TimeseriesOptions } from '@/utils/types';

type VolumeChartProps = {
  historicalData: MarketVolumes | undefined;
  market: Market;
  isLoading: boolean;
  volumeView: 'USD' | 'Asset';
  setVolumeView: (view: 'USD' | 'Asset') => void;
  selectedTimeframe: '1d' | '7d' | '30d';
  selectedTimeRange: TimeseriesOptions;
  handleTimeframeChange: (timeframe: '1d' | '7d' | '30d') => void;
};

function VolumeChart({
  historicalData,
  market,
  isLoading,
  volumeView,
  setVolumeView,
  selectedTimeframe,
  selectedTimeRange,
  handleTimeframeChange,
}: VolumeChartProps) {
  const formatYAxis = (value: number) => {
    if (volumeView === 'USD') {
      return `$${formatReadable(value)}`;
    }
    return formatReadable(value);
  };

  const formatTime = (unixTime: number) => {
    const date = new Date(unixTime * 1000);
    if (selectedTimeRange.endTimestamp - selectedTimeRange.startTimestamp <= 24 * 60 * 60) {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const getVolumeChartData = () => {
    if (!historicalData) return [];

    const supplyData = volumeView === 'USD' ? historicalData.supplyAssetsUsd : historicalData.supplyAssets;
    const borrowData = volumeView === 'USD' ? historicalData.borrowAssetsUsd : historicalData.borrowAssets;
    const liquidityData = volumeView === 'USD' ? historicalData.liquidityAssetsUsd : historicalData.liquidityAssets;

    // Process all data in a single loop
    return supplyData
      .map((point: TimeseriesDataPoint, index: number) => {
        // Get corresponding points from other series
        const borrowPoint: TimeseriesDataPoint | undefined = borrowData[index];
        const liquidityPoint: TimeseriesDataPoint | undefined = liquidityData[index];

        // Convert values based on view type
        const supplyValue = volumeView === 'USD' ? point.y : Number(formatUnits(BigInt(point.y), market.loanAsset.decimals));
        const borrowValue =
          volumeView === 'USD' ? borrowPoint?.y || 0 : Number(formatUnits(BigInt(borrowPoint?.y || 0), market.loanAsset.decimals));
        const liquidityValue =
          volumeView === 'USD' ? liquidityPoint?.y || 0 : Number(formatUnits(BigInt(liquidityPoint?.y || 0), market.loanAsset.decimals));

        // Check if any timestamps has USD value exceeds 100B
        if (historicalData.supplyAssetsUsd[index].y >= 100_000_000_000) {
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
    const data = volumeView === 'USD' ? historicalData?.[`${type}AssetsUsd`] : historicalData?.[`${type}Assets`];
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
    const data = volumeView === 'USD' ? historicalData?.[`${type}AssetsUsd`] : historicalData?.[`${type}Assets`];
    if (!data || data.length === 0) return 0;
    const sum = data.reduce(
      (acc: number, point: TimeseriesDataPoint) =>
        acc + Number(volumeView === 'USD' ? point.y : formatUnits(BigInt(point.y), market.loanAsset.decimals)),
      0,
    );
    return sum / data.length;
  };

  const volumeViewOptions = [
    { key: 'USD', label: 'USD', value: 'USD' },
    { key: 'Asset', label: market.loanAsset.symbol, value: 'Asset' },
  ];

  const timeframeOptions = [
    { key: '1d', label: '1D', value: '1d' },
    { key: '7d', label: '7D', value: '7d' },
    { key: '30d', label: '30D', value: '30d' },
  ];

  const [visibleLines, setVisibleLines] = useState({
    supply: true,
    borrow: true,
    liquidity: true,
  });

  // This is only for adaptive curve
  const targetUtilizationData = useMemo(() => {
    const supply = market.state.supplyAssets ? BigInt(market.state.supplyAssets) : 0n;
    const borrow = market.state.borrowAssets ? BigInt(market.state.borrowAssets) : 0n;

    // Calculate deltas to reach 90% target utilization
    const targetBorrow = (supply * 9n) / 10n; // B_target = S * 0.9
    const borrowDelta = targetBorrow - borrow;

    const targetSupply = (borrow * 10n) / 9n; // S_target = B / 0.9
    const supplyDelta = targetSupply - supply;

    return {
      borrowDelta,
      supplyDelta,
    };
  }, [market.state.supplyAssets, market.state.borrowAssets]);

  return (
    <Card className="bg-surface rounded p-4 shadow-sm">
      <CardHeader className="flex items-center justify-between px-6 py-4 text-xl">
        <span />
        <div className="flex gap-4">
          <ButtonGroup
            options={volumeViewOptions}
            value={volumeView}
            onChange={(value) => setVolumeView(value as 'USD' | 'Asset')}
            size="sm"
            variant="default"
          />
          <ButtonGroup
            options={timeframeOptions}
            value={selectedTimeframe}
            onChange={(value) => handleTimeframeChange(value as '1d' | '7d' | '30d')}
            size="sm"
            variant="default"
          />
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center text-primary">
                <Spinner size={30} />
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={400}
                id="volume-chart"
              >
                <AreaChart data={getVolumeChartData()}>
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
                        stopColor={CHART_COLORS.supply.gradient.start}
                        stopOpacity={CHART_COLORS.supply.gradient.startOpacity}
                      />
                      <stop
                        offset="25%"
                        stopColor={CHART_COLORS.supply.gradient.start}
                        stopOpacity={CHART_COLORS.supply.gradient.endOpacity}
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
                        stopColor={CHART_COLORS.borrow.gradient.start}
                        stopOpacity={CHART_COLORS.borrow.gradient.startOpacity}
                      />
                      <stop
                        offset="25%"
                        stopColor={CHART_COLORS.borrow.gradient.start}
                        stopOpacity={CHART_COLORS.borrow.gradient.endOpacity}
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
                        stopColor={CHART_COLORS.apyAtTarget.gradient.start}
                        stopOpacity={CHART_COLORS.apyAtTarget.gradient.startOpacity}
                      />
                      <stop
                        offset="25%"
                        stopColor={CHART_COLORS.apyAtTarget.gradient.start}
                        stopOpacity={CHART_COLORS.apyAtTarget.gradient.endOpacity}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    tickFormatter={formatTime}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    labelFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleString()}
                    formatter={(value: number, name: string) => [formatValue(value), name]}
                    contentStyle={{
                      backgroundColor: 'var(--color-background)',
                    }}
                  />
                  <Legend
                    onClick={(e) => {
                      const dataKey = e.dataKey as keyof typeof visibleLines;
                      setVisibleLines((prev) => ({
                        ...prev,
                        [dataKey]: !prev[dataKey],
                      }));
                    }}
                    formatter={(value, entry) => (
                      <span
                        style={{
                          color: visibleLines[(entry as any).dataKey as keyof typeof visibleLines] ? undefined : '#999',
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="supply"
                    name="Supply Volume"
                    stroke={CHART_COLORS.supply.stroke}
                    strokeWidth={2}
                    fill="url(#volumeChart-supplyGradient)"
                    fillOpacity={1}
                    hide={!visibleLines.supply}
                  />
                  <Area
                    type="monotone"
                    dataKey="borrow"
                    name="Borrow Volume"
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
          <div>
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-lg text-secondary">Current Volumes</h3>
                {['supply', 'borrow', 'liquidity'].map((type) => {
                  const stats = getCurrentVolumeStats(type as 'supply' | 'borrow' | 'liquidity');
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between"
                    >
                      <span className="capitalize">{type}:</span>
                      <span className="font-zen text-sm">
                        {formatValue(stats.current)}
                        <span className={stats.netChangePercentage > 0 ? 'ml-2 text-green-500' : 'ml-2 text-red-500'}>
                          ({stats.netChangePercentage > 0 ? '+' : ''}
                          {stats.netChangePercentage.toFixed(2)}%)
                        </span>
                      </span>
                    </div>
                  );
                })}

                {/* Delta to target Utilization */}
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                  <h3 className="mb-1 text text-secondary text-base">IRM Targets </h3>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>Supply Δ:</span>
                      <HeroTooltip                        content={
                          <TooltipContent
                            title="Supply Delta to Target"
                            detail="Supply change needed to reach 90% target utilization (keeping borrow constant). Positive = add supply. Negative = withdraw supply."
                          />
                        }
                      >
                        <span className="cursor-help">
                          <HiOutlineInformationCircle className="h-4 w-4 text-secondary" />
                        </span>
                      </HeroTooltip>
                    </span>
                    <span className="text-sm">
                      {formatValue(Number(formatUnits(targetUtilizationData.supplyDelta, market.loanAsset.decimals)))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>Borrow Δ:</span>
                      <HeroTooltip                        content={
                          <TooltipContent
                            title="Borrow Delta to Target"
                            detail="Borrow change needed to reach 90% target utilization (keeping supply constant). Positive = borrow more. Negative = repay."
                          />
                        }
                      >
                        <span className="cursor-help">
                          <HiOutlineInformationCircle className="h-4 w-4 text-secondary" />
                        </span>
                      </HeroTooltip>
                    </span>
                    <span className="text-sm">
                      {formatValue(Number(formatUnits(targetUtilizationData.borrowDelta, market.loanAsset.decimals)))}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-lg text-secondary">
                  Historical Averages <span className="text-secondary">({selectedTimeframe})</span>
                </h3>
                {isLoading ? (
                  <div className="flex min-h-48 justify-center text-primary">
                    <Spinner size={24} />
                  </div>
                ) : (
                  ['supply', 'borrow', 'liquidity'].map((type) => (
                    <div
                      key={type}
                      className="flex items-center justify-between"
                    >
                      <span className="capitalize">{type}:</span>
                      <span className="font-zen text-sm">
                        {formatValue(getAverageVolumeStats(type as 'supply' | 'borrow' | 'liquidity'))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default VolumeChart;
