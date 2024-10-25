'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMarket, useMarketHistoricalData } from '@/hooks/useMarket';
import { TimeseriesOptions } from '@/utils/types';
import { useState } from 'react';
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
import { Card, CardHeader, CardBody } from '@nextui-org/card';
import { Spinner } from '@nextui-org/spinner';
import { Button } from '@nextui-org/button';
import { Progress } from '@nextui-org/progress';
import Image from 'next/image';
import Link from 'next/link';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { formatUnits } from 'viem';
import { OracleFeedInfo } from '@/components/FeedInfo/OracleFeedInfo';
import { ExternalLinkIcon, ChevronLeftIcon } from '@radix-ui/react-icons';
import { getExplorerURL } from '@/utils/external';
import { getIRMTitle } from '@/utils/morpho';
import Header from '@/components/layout/header/Header';

const MarketContent = () => {
  const { marketid } = useParams();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeseriesOptions>({
    startTimestamp: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60, // 1 week ago
    endTimestamp: Math.floor(Date.now() / 1000),
    interval: 'HOUR',
  });
  const [apyTimeframe, setApyTimeframe] = useState<'now' | '1day' | '7day' | '30day'>('now');
  const [chartType, setChartType] = useState<'apy' | 'utilization'>('apy');

  const { data: market, isLoading, error } = useMarket(marketid as string);
  const { data: historicalData, isLoading: isHistoricalLoading } = useMarketHistoricalData(
    marketid as string,
    timeRange,
  );

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  if (error)
    return <div className="text-center text-red-500">Error: {(error as Error).message}</div>;
  if (!market) return <div className="text-center">Market not found</div>;

  const chainImg = getNetworkImg(market.morphoBlue.chain.id);
  const loanImg = findToken(market.loanAsset.address, market.morphoBlue.chain.id)?.img;
  const collateralImg = findToken(market.collateralAsset.address, market.morphoBlue.chain.id)?.img;

  const formatTime = (unixTime: number) => {
    const date = new Date(unixTime * 1000);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const setTimeRangeAndRefetch = (days: number) => {
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - days * 24 * 60 * 60;
    setTimeRange({
      startTimestamp,
      endTimestamp,
      interval: days > 30 ? 'DAY' : 'HOUR',
    });
  };

  const cardStyle = 'bg-background rounded-sm shadow-sm p-4';

  const getApyValue = (type: 'supply' | 'borrow') => {
    if (apyTimeframe === 'now') {
      return type === 'supply' ? market.state.supplyApy : market.state.borrowApy;
    }
    if (!historicalData) return 0;
    const data =
      type === 'supply'
        ? apyTimeframe === '1day'
          ? historicalData.dailySupplyApy
          : apyTimeframe === '7day'
          ? historicalData.weeklySupplyApy
          : historicalData.monthlySupplyApy
        : apyTimeframe === '1day'
        ? historicalData.dailyBorrowApy
        : apyTimeframe === '7day'
        ? historicalData.weeklyBorrowApy
        : historicalData.monthlyBorrowApy;
    return data[data.length - 1]?.y || 0;
  };

  const averageLTV =
    market.state.collateralAssetsUsd && market.state.collateralAssetsUsd > 0
      ? (parseFloat(market.state.borrowAssetsUsd) / market.state.collateralAssetsUsd) * 100
      : 0;

  const calculateAverageUtilization = (days: number) => {
    if (!historicalData || !historicalData.utilization) return 0;
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;
    const relevantData = historicalData.utilization.filter(
      (point: { x: number; y: number }) => point.x >= startTime && point.x <= endTime,
    );
    const total = relevantData.reduce((sum: number, point: { y: number }) => sum + point.y, 0);
    return relevantData.length ? total / relevantData.length : 0;
  };

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 font-zen pb-12">
        <Button
          onClick={() => router.push('/markets')}
          className="mb-4"
          startContent={<ChevronLeftIcon />}
        >
          Back to Markets
        </Button>
        <h1 className="mb-8 text-center text-3xl">
          {market.loanAsset.symbol}/{market.collateralAsset.symbol} Market
        </h1>

        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          <Card className={cardStyle}>
            <CardHeader className="text-xl">Basic Info</CardHeader>
            <CardBody>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Loan Asset:</span>
                  <div className="flex items-center">
                    {loanImg && (
                      <Image
                        src={loanImg}
                        alt={market.loanAsset.symbol}
                        width={24}
                        height={24}
                        className="mr-2"
                      />
                    )}
                    <Link
                      href={getExplorerURL(market.loanAsset.address, market.morphoBlue.chain.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center hover:underline"
                    >
                      {market.loanAsset.symbol} <ExternalLinkIcon className="ml-1" />
                    </Link>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Collateral Asset:</span>
                  <div className="flex items-center">
                    {collateralImg && (
                      <Image
                        src={collateralImg}
                        alt={market.collateralAsset.symbol}
                        width={24}
                        height={24}
                        className="mr-2"
                      />
                    )}
                    <Link
                      href={getExplorerURL(
                        market.collateralAsset.address,
                        market.morphoBlue.chain.id,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center hover:underline"
                    >
                      {market.collateralAsset.symbol} <ExternalLinkIcon className="ml-1" />
                    </Link>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>IRM:</span>
                  <Link
                    href={getExplorerURL(market.irmAddress, market.morphoBlue.chain.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:underline"
                  >
                    {getIRMTitle(market.irmAddress)} <ExternalLinkIcon className="ml-1" />
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={cardStyle}>
            <CardHeader className="text-xl">LLTV Info</CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>LLTV:</span>
                  <span>{formatUnits(BigInt(market.lltv), 16)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Average LTV:</span>
                  <span>{averageLTV.toFixed(2)}%</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={cardStyle}>
            <CardHeader className="text-xl">Oracle Info</CardHeader>
            <CardBody>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Vendor:</span>
                  <Link
                    href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:underline"
                  >
                    <OracleVendorBadge oracleData={market.oracle.data} showText={true} />{' '}
                    <ExternalLinkIcon className="ml-1" />
                  </Link>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Feed Routes:</h4>
                  <OracleFeedInfo
                    feed={market.oracle.data.baseFeedOne}
                    chainId={market.morphoBlue.chain.id}
                  />
                  <OracleFeedInfo
                    feed={market.oracle.data.baseFeedTwo}
                    chainId={market.morphoBlue.chain.id}
                  />
                  <OracleFeedInfo
                    feed={market.oracle.data.quoteFeedOne}
                    chainId={market.morphoBlue.chain.id}
                  />
                  <OracleFeedInfo
                    feed={market.oracle.data.quoteFeedTwo}
                    chainId={market.morphoBlue.chain.id}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <Card className={cardStyle}>
            <CardHeader className="text-xl">Volumes</CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total Supply:</span>
                  <div className="text-right">
                    <div>${formatReadable(parseFloat(market.state.supplyAssetsUsd))}</div>
                    <div className="text-sm opacity-70">
                      {formatReadable(
                        parseFloat(
                          formatUnits(BigInt(market.state.supplyAssets), market.loanAsset.decimals),
                        ),
                      )}{' '}
                      {market.loanAsset.symbol}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Borrow:</span>
                  <div className="text-right">
                    <div>${formatReadable(parseFloat(market.state.borrowAssetsUsd))}</div>
                    <div className="text-sm opacity-70">
                      {formatReadable(
                        parseFloat(
                          formatUnits(BigInt(market.state.borrowAssets), market.loanAsset.decimals),
                        ),
                      )}{' '}
                      {market.loanAsset.symbol}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Available Liquidity:</span>
                  <div className="text-right">
                    <div>${formatReadable(market.state.liquidityAssetsUsd)}</div>
                    <div className="text-sm opacity-70">
                      {formatReadable(
                        parseFloat(
                          formatUnits(
                            BigInt(market.state.liquidityAssets),
                            market.loanAsset.decimals,
                          ),
                        ),
                      )}{' '}
                      {market.loanAsset.symbol}
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={cardStyle}>
            <CardHeader className="text-xl">Rates</CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="mb-2 flex items-center justify-between">
                  <span>Timeframe:</span>
                  <div>
                    <Button
                      size="sm"
                      onClick={() => setApyTimeframe('now')}
                      color={apyTimeframe === 'now' ? 'warning' : 'default'}
                    >
                      Now
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setApyTimeframe('1day')}
                      color={apyTimeframe === '1day' ? 'warning' : 'default'}
                    >
                      1d avg
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setApyTimeframe('7day')}
                      color={apyTimeframe === '7day' ? 'warning' : 'default'}
                    >
                      7d avg
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setApyTimeframe('30day')}
                      color={apyTimeframe === '30day' ? 'warning' : 'default'}
                    >
                      30d avg
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Supply APY:</span>
                  <span>{(getApyValue('supply') * 100).toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Borrow APY:</span>
                  <span>{(getApyValue('borrow') * 100).toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Utilization Rate:</span>
                  <Progress
                    aria-label="Utilization Rate"
                    size="sm"
                    value={
                      apyTimeframe === 'now'
                        ? market.state.utilization * 100
                        : apyTimeframe === '1day'
                        ? calculateAverageUtilization(1) * 100
                        : apyTimeframe === '7day'
                        ? calculateAverageUtilization(7) * 100
                        : calculateAverageUtilization(30) * 100
                    }
                    color="warning"
                    showValueLabel={true}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className={`${cardStyle} mb-8`}>
          <CardHeader className="flex items-center justify-between">
            <span className="text-xl">Historical Data</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setTimeRangeAndRefetch(7)}
                color={
                  timeRange.endTimestamp - timeRange.startTimestamp === 7 * 24 * 60 * 60
                    ? 'warning'
                    : 'default'
                }
              >
                1W
              </Button>
              <Button
                size="sm"
                onClick={() => setTimeRangeAndRefetch(30)}
                color={
                  timeRange.endTimestamp - timeRange.startTimestamp === 30 * 24 * 60 * 60
                    ? 'warning'
                    : 'default'
                }
              >
                1M
              </Button>
              <Button
                size="sm"
                onClick={() => setTimeRangeAndRefetch(365)}
                color={
                  timeRange.endTimestamp - timeRange.startTimestamp === 365 * 24 * 60 * 60
                    ? 'warning'
                    : 'default'
                }
              >
                1Y
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="mb-4 flex justify-center">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <Button
                  onClick={() => setChartType('apy')}
                  color={chartType === 'apy' ? 'warning' : 'default'}
                >
                  APY
                </Button>
                <Button
                  onClick={() => setChartType('utilization')}
                  color={chartType === 'utilization' ? 'warning' : 'default'}
                >
                  Utilization
                </Button>
              </div>
            </div>
            {isHistoricalLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historicalData?.supplyApy}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" tickFormatter={formatTime} />
                  <YAxis tickFormatter={(value) => `${(value * 100).toFixed(2)}%`} />
                  <Tooltip
                    labelFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleString()}
                    formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                  />
                  <Legend />
                  {chartType === 'apy' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="y"
                        name="Supply APY"
                        stroke="#3B82F6" // Blue
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey={(data) =>
                          historicalData?.borrowApy.find((item: any) => item.x === data.x)?.y
                        }
                        name="Borrow APY"
                        stroke="#10B981" // Green
                        strokeWidth={2}
                        dot={false}
                      />
                    </>
                  )}
                  {chartType === 'utilization' && (
                    <Line
                      type="monotone"
                      dataKey={(data) =>
                        historicalData?.utilization.find((item: any) => item.x === data.x)?.y
                      }
                      name="Utilization Rate"
                      stroke="#3B82F6" // Blue
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
};

export default MarketContent;
