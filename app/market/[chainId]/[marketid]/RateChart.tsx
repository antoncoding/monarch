/* eslint-disable react/no-unstable-nested-components */

import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '@heroui/react';
import { Progress } from '@heroui/react';
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
import { MarketRates } from '@/utils/types';
import { TimeseriesDataPoint, Market, TimeseriesOptions } from '@/utils/types';

type RateChartProps = {
  historicalData: MarketRates | undefined;
  market: Market;
  isLoading: boolean;
  selectedTimeframe: '1d' | '7d' | '30d';
  selectedTimeRange: TimeseriesOptions;
  handleTimeframeChange: (timeframe: '1d' | '7d' | '30d') => void;
};

function RateChart({
  historicalData,
  market,
  isLoading,
  selectedTimeframe,
  selectedTimeRange,
  handleTimeframeChange,
}: RateChartProps) {
  const [visibleLines, setVisibleLines] = useState({
    supplyApy: true,
    borrowApy: true,
    apyAtTarget: true,
  });

  const getChartData = () => {
    if (!historicalData) return [];
    const { supplyApy, borrowApy, apyAtTarget } = historicalData;

    return supplyApy.map((point: TimeseriesDataPoint, index: number) => ({
      x: point.x,
      supplyApy: point.y,
      borrowApy: borrowApy[index]?.y || 0,
      apyAtTarget: apyAtTarget[index]?.y || 0,
    }));
  };

  console.log('market', market);

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;

  const getCurrentApyValue = (type: 'supply' | 'borrow') => {
    return type === 'supply' ? market.state.supplyApy : market.state.borrowApy;
  };

  const getAverageApyValue = (type: 'supply' | 'borrow') => {
    if (!historicalData) return 0;
    const data = type === 'supply' ? historicalData.supplyApy : historicalData.borrowApy;
    return data.length > 0
      ? data.reduce((sum: number, point: TimeseriesDataPoint) => sum + point.y, 0) / data.length
      : 0;
  };

  const getCurrentapyAtTargetValue = () => {
    return market.state.apyAtTarget;
  };

  const getAverageapyAtTargetValue = () => {
    if (!historicalData?.apyAtTarget || historicalData.apyAtTarget.length === 0) return 0;
    return (
      historicalData.apyAtTarget.reduce(
        (sum: number, point: TimeseriesDataPoint) => sum + point.y,
        0,
      ) / historicalData.apyAtTarget.length
    );
  };

  const getCurrentUtilizationRate = () => {
    return market.state.utilization;
  };

  const getAverageUtilizationRate = () => {
    if (!historicalData?.utilization || historicalData.utilization.length === 0) return 0;
    return (
      historicalData.utilization.reduce(
        (sum: number, point: TimeseriesDataPoint) => sum + point.y,
        0,
      ) / historicalData.utilization.length
    );
  };

  const formatTime = (unixTime: number) => {
    const date = new Date(unixTime * 1000);
    if (selectedTimeRange.endTimestamp - selectedTimeRange.startTimestamp <= 86400) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const timeframeOptions = [
    { key: '1d', label: '1D', value: '1d' },
    { key: '7d', label: '7D', value: '7d' },
    { key: '30d', label: '30D', value: '30d' },
  ];

  return (
    <Card className="bg-surface my-4 rounded p-4 shadow-sm">
      <CardHeader className="flex items-center justify-between px-6 py-4 text-xl">
        <span />
        <ButtonGroup
          options={timeframeOptions}
          value={selectedTimeframe}
          onChange={(value) => handleTimeframeChange(value as '1d' | '7d' | '30d')}
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
                    dataKey="apyAtTarget"
                    name="Rate at Util Target"
                    stroke={CHART_COLORS.apyAtTarget.stroke}
                    strokeWidth={2}
                    fill="url(#rateChart-targetGradient)"
                    fillOpacity={1}
                    hide={!visibleLines.apyAtTarget}
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
                    {formatPercentage(getCurrentapyAtTargetValue())}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-lg font-semibold">
                  Historical Averages{' '}
                  <span className="font-normal text-gray-500">({selectedTimeframe})</span>
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
                        {formatPercentage(getAverageapyAtTargetValue())}
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
