import React, { useCallback } from 'react';
import { Card, CardHeader, CardBody } from '@nextui-org/card';
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
import { formatUnits } from 'viem';
import ButtonGroup from '@/components/ButtonGroup';
import { formatReadable } from '@/utils/balance';
import { TimeseriesDataPoint, MarketHistoricalData, Market } from '@/utils/types';

type VolumeChartProps = {
  historicalData: MarketHistoricalData['volumes'] | undefined;
  market: Market;
  isLoading: boolean;
  volumeView: 'USD' | 'Asset';
  volumeTimeframe: '1day' | '7day' | '30day';
  setVolumeTimeframe: (timeframe: '1day' | '7day' | '30day') => void;
  setTimeRangeAndRefetch: (days: number, type: 'volume') => void;
  formatTime: (unixTime: number) => string;
  setVolumeView: (view: 'USD' | 'Asset') => void;
};

function VolumeChart({
  historicalData,
  market,
  isLoading,
  volumeView,
  volumeTimeframe,
  setVolumeTimeframe,
  setTimeRangeAndRefetch,
  formatTime,
  setVolumeView,
}: VolumeChartProps) {
  const formatYAxis = (value: number) => {
    if (volumeView === 'USD') {
      return `$${formatReadable(value)}`;
    } else {
      return formatReadable(value);
    }
  };

  const getVolumeChartData = () => {
    if (!historicalData) return [];
    const supplyData =
      volumeView === 'USD' ? historicalData.supplyAssetsUsd : historicalData.supplyAssets;
    const borrowData =
      volumeView === 'USD' ? historicalData.borrowAssetsUsd : historicalData.borrowAssets;
    const liquidityData =
      volumeView === 'USD' ? historicalData.liquidityAssetsUsd : historicalData.liquidityAssets;

    return supplyData.map((point: TimeseriesDataPoint, index: number) => ({
      x: point.x,
      supply:
        volumeView === 'USD'
          ? point.y
          : Number(formatUnits(BigInt(point.y), market.loanAsset.decimals)),
      borrow:
        volumeView === 'USD'
          ? borrowData[index]?.y
          : Number(formatUnits(BigInt(borrowData[index]?.y || 0), market.loanAsset.decimals)),
      liquidity:
        volumeView === 'USD'
          ? liquidityData[index]?.y
          : Number(formatUnits(BigInt(liquidityData[index]?.y || 0), market.loanAsset.decimals)),
    }));
  };

  const formatValue = (value: number) => {
    const formattedValue = formatReadable(value);
    return volumeView === 'USD'
      ? `$${formattedValue}`
      : `${formattedValue} ${market.loanAsset.symbol}`;
  };

  const getCurrentVolumeStats = (type: 'supply' | 'borrow' | 'liquidity') => {
    const data =
      volumeView === 'USD'
        ? historicalData?.[`${type}AssetsUsd`]
        : historicalData?.[`${type}Assets`];
    if (!data || data.length === 0) return { current: 0, netChange: 0, netChangePercentage: 0 };

    const current =
      volumeView === 'USD'
        ? data[data.length - 1].y
        : Number(formatUnits(BigInt(data[data.length - 1].y), market.loanAsset.decimals));
    const start =
      volumeView === 'USD'
        ? data[0].y
        : Number(formatUnits(BigInt(data[0].y), market.loanAsset.decimals));
    const netChange = current - start;
    const netChangePercentage = (netChange / start) * 100;

    return { current, netChange, netChangePercentage };
  };

  const getAverageVolumeStats = (type: 'supply' | 'borrow' | 'liquidity') => {
    const data =
      volumeView === 'USD'
        ? historicalData?.[`${type}AssetsUsd`]
        : historicalData?.[`${type}Assets`];
    if (!data) return 0;
    const sum = data.reduce(
      (acc, point) =>
        acc +
        Number(
          volumeView === 'USD' ? point.y : formatUnits(BigInt(point.y), market.loanAsset.decimals),
        ),
      0,
    );
    return sum / data.length;
  };

  const volumeViewOptions = [
    { key: 'USD', label: 'USD', value: 'USD' },
    { key: 'Asset', label: market.loanAsset.symbol, value: 'Asset' },
  ];

  const timeframeOptions = [
    { key: '1day', label: '1D', value: '1day' },
    { key: '7day', label: '7D', value: '7day' },
    { key: '30day', label: '30D', value: '30day' },
  ];

  const handleTimeframeChange = useCallback(
    (value: string) => {
      setVolumeTimeframe(value as '1day' | '7day' | '30day');
      const days = value === '1day' ? 1 : value === '7day' ? 7 : 30;
      setTimeRangeAndRefetch(days, 'volume');
    },
    [setVolumeTimeframe, setTimeRangeAndRefetch],
  );

  return (
    <Card className="bg-surface my-4 rounded-sm p-4 shadow-sm">
      <CardHeader className="flex items-center justify-between px-6 py-4 text-xl">
        <span>Volumes</span>
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
            value={volumeTimeframe}
            onChange={handleTimeframeChange}
            size="sm"
            variant="default"
          />
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
                <LineChart data={getVolumeChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" tickFormatter={formatTime} />
                  <YAxis tickFormatter={formatYAxis} domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleString()}
                    formatter={(value: number, name: string) => [formatValue(value), name]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="supply"
                    name="Supply Volume"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="borrow"
                    name="Borrow Volume"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="liquidity"
                    name="Liquidity"
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
                <h3 className="mb-1 text-lg font-semibold">Current Volumes</h3>
                {['supply', 'borrow', 'liquidity'].map((type) => {
                  const stats = getCurrentVolumeStats(type as 'supply' | 'borrow' | 'liquidity');
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type}:</span>
                      <span className="font-monospace text-sm">
                        {formatValue(stats.current)}
                        <span
                          className={
                            stats.netChangePercentage > 0
                              ? 'ml-2 text-green-500'
                              : 'ml-2 text-red-500'
                          }
                        >
                          ({stats.netChangePercentage > 0 ? '+' : ''}
                          {stats.netChangePercentage.toFixed(2)}%)
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div>
                <h3 className="mb-1 text-lg font-semibold">
                  Historical Averages{' '}
                  <span className="font-normal text-gray-500">({volumeTimeframe})</span>
                </h3>
                {isLoading ? (
                  <div className="flex min-h-48 justify-center">
                    <Spinner size="sm" />
                  </div>
                ) : (
                  <>
                    {['supply', 'borrow', 'liquidity'].map((type) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="capitalize">{type}:</span>
                        <span className="font-monospace text-sm">
                          {formatValue(
                            getAverageVolumeStats(type as 'supply' | 'borrow' | 'liquidity'),
                          )}
                        </span>
                      </div>
                    ))}
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

export default VolumeChart;
