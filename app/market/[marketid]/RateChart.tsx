import React from 'react';
import { Button } from '@nextui-org/button';
import { Card, CardHeader, CardBody } from '@nextui-org/card';
import { Progress } from '@nextui-org/progress';
import { Spinner } from '@nextui-org/spinner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TimeseriesDataPoint, MarketHistoricalData, Market } from '@/utils/types';

type RateChartProps = {
  historicalData: MarketHistoricalData['rates'] | undefined;
  market: Market;
  isLoading: boolean;
  apyTimeframe: '1day' | '7day' | '30day';
  setApyTimeframe: (timeframe: '1day' | '7day' | '30day') => void;
  setTimeRangeAndRefetch: (days: number, type: 'rate') => void;
  formatTime: (unixTime: number) => string;
};

function RateChart({
  historicalData,
  market,
  isLoading,
  apyTimeframe,
  setApyTimeframe,
  setTimeRangeAndRefetch,
  formatTime,
}: RateChartProps) {
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
    return data.reduce((sum, point) => sum + point.y, 0) / data.length;
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

  return (
    <Card className="my-4 rounded-sm bg-surface p-4 shadow-sm">
      <CardHeader className="flex items-center justify-between px-6 py-4 text-xl">
        <span>Rates</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              setApyTimeframe('1day');
              setTimeRangeAndRefetch(1, 'rate');
            }}
            color={apyTimeframe === '1day' ? 'warning' : 'default'}
          >
            1D
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setApyTimeframe('7day');
              setTimeRangeAndRefetch(7, 'rate');
            }}
            color={apyTimeframe === '7day' ? 'warning' : 'default'}
          >
            7D
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setApyTimeframe('30day');
              setTimeRangeAndRefetch(30, 'rate');
            }}
            color={apyTimeframe === '30day' ? 'warning' : 'default'}
          >
            30D
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" tickFormatter={formatTime} />
                  <YAxis tickFormatter={(value) => `${(value * 100).toFixed(2)}%`} />
                  <Tooltip
                    labelFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleString()}
                    formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="supplyApy"
                    name="Supply APY"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="borrowApy"
                    name="Borrow APY"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rateAtUTarget"
                    name="Rate at U Target"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
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
                  <div className="flex min-h-48 justify-center">
                    <Spinner size="sm" />
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
