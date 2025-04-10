/* eslint-disable react/no-unstable-nested-components */

import React, { useCallback, useState } from 'react';
import { Card, CardHeader, CardBody } from '@nextui-org/card';
import { Progress } from '@nextui-org/progress';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ButtonGroup from '@/components/ButtonGroup';
import { Spinner } from '@/components/common/Spinner';
import { CHART_COLORS } from '@/constants/chartColors';
import {
  TimeseriesDataPoint,
  MarketHistoricalData,
  Market,
  TimeseriesOptions,
} from '@/utils/types';

type RateChartProps = {
  historicalData: MarketHistoricalData['rates'] | undefined;
  market: Market;
  isLoading: boolean;
  apyTimeframe: '1day' | '7day' | '30day';
  setApyTimeframe: (timeframe: '1day' | '7day' | '30day') => void;
  setTimeRangeAndRefetch: (days: number, type: 'rate') => void;
  rateTimeRange: TimeseriesOptions;
};

function RateChart({
  historicalData,
  market,
  isLoading,
  apyTimeframe,
  setApyTimeframe,
  setTimeRangeAndRefetch,
  rateTimeRange,
}: RateChartProps) {
  const [visibleLines, setVisibleLines] = useState({
    supplyApy: true,
    borrowApy: true,
    rateAtUTarget: true,
  });

  const getChartData = () => {
    if (!historicalData) return [];
    const { supplyApy, borrowApy, rateAtUTarget } = historicalData;

    return supplyApy.map((point: TimeseriesDataPoint, index: number) => ({
      x: point.x,
      supplyApy: point.y,
      borrowApy: borrowApy[index]?.y || 0,
      rateAtUTarget: rateAtUTarget[index]?.y || 0,
    }));
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;

  const getCurrentApyValue = (type: 'supply' | 'borrow') => {
    return type === 'supply' ? market.state.supplyApy : market.state.borrowApy;
  };

  const getAverageApyValue = (type: 'supply' | 'borrow') => {
    if (!historicalData) return 0;
    const data = type === 'supply' ? historicalData.supplyApy : historicalData.borrowApy;
    return data.length > 0 ? data.reduce((sum, point) => sum + point.y, 0) / data.length : 0;
  };

  const getCurrentRateAtUTargetValue = () => {
    return market.state.rateAtUTarget;
  };

  const getAverageRateAtUTargetValue = () => {
    if (!historicalData?.rateAtUTarget) return 0;
    return (
      historicalData.rateAtUTarget.reduce((sum, point) => sum + point.y, 0) /
      historicalData.rateAtUTarget.length
    );
  };

  const getCurrentUtilizationRate = () => {
    return market.state.utilization;
  };

  const getAverageUtilizationRate = () => {
    if (!historicalData?.utilization) return 0;
    return (
      historicalData.utilization.reduce((sum, point) => sum + point.y, 0) /
      historicalData.utilization.length
    );
  };

  const formatTime = (unixTime: number) => {
    const date = new Date(unixTime * 1000);
    if (rateTimeRange.endTimestamp - rateTimeRange.startTimestamp <= 86400) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const timeframeOptions = [
    { key: '1day', label: '1D', value: '1day' },
    { key: '7day', label: '7D', value: '7day' },
    { key: '30day', label: '30D', value: '30day' },
  ];

  const handleTimeframeChange = useCallback(
    (value: string) => {
      setApyTimeframe(value as '1day' | '7day' | '30day');
      const days = value === '1day' ? 1 : value === '7day' ? 7 : 30;
      setTimeRangeAndRefetch(days, 'rate');
    },
    [setApyTimeframe, setTimeRangeAndRefetch],
  );

  return (
    <Card className="bg-surface my-4 rounded p-4 shadow-sm">
      <CardHeader className="flex items-center justify-between px-6 py-4 text-xl">
        <span />
        <ButtonGroup
          options={timeframeOptions}
          value={apyTimeframe}
          onChange={handleTimeframeChange}
          size="sm"
          variant="default"
        />
      </CardHeader>
      <CardBody>
        <div className="mb-4 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size={30} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400} id="rate-chart">
                <AreaChart data={getChartData()}>
                  <defs>
                    <linearGradient id="rateChart-supplyGradient" x1="0" y1="0" x2="0" y2="1">
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
                    <linearGradient id="rateChart-borrowGradient" x1="0" y1="0" x2="0" y2="1">
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
                    <linearGradient id="rateChart-targetGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={CHART_COLORS.rateAtUTarget.gradient.start}
                        stopOpacity={CHART_COLORS.rateAtUTarget.gradient.startOpacity}
                      />
                      <stop
                        offset="25%"
                        stopColor={CHART_COLORS.rateAtUTarget.gradient.start}
                        stopOpacity={CHART_COLORS.rateAtUTarget.gradient.endOpacity}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" tickFormatter={formatTime} />
                  <YAxis tickFormatter={(value) => `${(value * 100).toFixed(2)}%`} />
                  <Tooltip
                    labelFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleString()}
                    formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
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
                          color: visibleLines[(entry as any).dataKey as keyof typeof visibleLines]
                            ? undefined
                            : '#999',
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="supplyApy"
                    name="Supply APY"
                    stroke={CHART_COLORS.supply.stroke}
                    strokeWidth={2}
                    fill="url(#rateChart-supplyGradient)"
                    fillOpacity={1}
                    hide={!visibleLines.supplyApy}
                  />
                  <Area
                    type="monotone"
                    dataKey="borrowApy"
                    name="Borrow APY"
                    stroke={CHART_COLORS.borrow.stroke}
                    strokeWidth={2}
                    fill="url(#rateChart-borrowGradient)"
                    fillOpacity={1}
                    hide={!visibleLines.borrowApy}
                  />
                  <Area
                    type="monotone"
                    dataKey="rateAtUTarget"
                    name="Rate at Util Target"
                    stroke={CHART_COLORS.rateAtUTarget.stroke}
                    strokeWidth={2}
                    fill="url(#rateChart-targetGradient)"
                    fillOpacity={1}
                    hide={!visibleLines.rateAtUTarget}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-lg font-semibold">Current Rates</h3>
                <div className="mb-2">
                  <Progress
                    label="Utilization Rate"
                    aria-label="Utilization Rate"
                    size="sm"
                    value={getCurrentUtilizationRate() * 100}
                    color="primary"
                    showValueLabel
                    classNames={{
                      value: 'font-monospace text-sm',
                      base: 'my-2',
                      label: 'text-base',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Supply APY:</span>
                  <span className="font-monospace text-sm">
                    {formatPercentage(getCurrentApyValue('supply'))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Borrow APY:</span>
                  <span className="font-monospace text-sm">
                    {formatPercentage(getCurrentApyValue('borrow'))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rate at U Target:</span>
                  <span className="font-monospace text-sm">
                    {formatPercentage(getCurrentRateAtUTargetValue())}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-lg font-semibold">
                  Historical Averages{' '}
                  <span className="font-normal text-gray-500">({apyTimeframe})</span>
                </h3>
                {isLoading ? (
                  <div className="flex min-h-48 justify-center text-primary">
                    <Spinner size={24} />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Utilization Rate:</span>
                      <span className="font-monospace text-sm">
                        {formatPercentage(getAverageUtilizationRate())}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Supply APY:</span>
                      <span className="font-monospace text-sm">
                        {formatPercentage(getAverageApyValue('supply'))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Borrow APY:</span>
                      <span className="font-monospace text-sm">
                        {formatPercentage(getAverageApyValue('borrow'))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rate at U Target:</span>
                      <span className="font-monospace text-sm">
                        {formatPercentage(getAverageRateAtUTargetValue())}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default RateChart;
