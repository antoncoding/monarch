'use client';

import { useState, useCallback } from 'react';
import { Button } from '@nextui-org/button';
import { Card, CardHeader, CardBody } from '@nextui-org/card';
import { Spinner } from '@nextui-org/spinner';
import { ExternalLinkIcon, ChevronLeftIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatUnits } from 'viem';
import { OracleFeedInfo } from '@/components/FeedInfo/OracleFeedInfo';
import Header from '@/components/layout/header/Header';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { useMarket, useMarketHistoricalData } from '@/hooks/useMarket';
import { getExplorerURL } from '@/utils/external';
import { getIRMTitle } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';
import { TimeseriesOptions } from '@/utils/types';
import RateChart from './RateChart';
import VolumeChart from './VolumeChart';

function MarketContent() {
  const { marketid } = useParams();
  const router = useRouter();
  const [rateTimeRange, setRateTimeRange] = useState<TimeseriesOptions>({
    startTimestamp: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
    endTimestamp: Math.floor(Date.now() / 1000),
    interval: 'HOUR',
  });
  const [volumeTimeRange, setVolumeTimeRange] = useState<TimeseriesOptions>({
    startTimestamp: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
    endTimestamp: Math.floor(Date.now() / 1000),
    interval: 'HOUR',
  });
  const [apyTimeframe, setApyTimeframe] = useState<'1day' | '7day' | '30day'>('7day');
  const [volumeTimeframe, setVolumeTimeframe] = useState<'1day' | '7day' | '30day'>('7day');
  const [volumeView, setVolumeView] = useState<'USD' | 'Asset'>('USD');

  const {
    data: market,
    isLoading: isMarketLoading,
    error: marketError,
  } = useMarket(marketid as string);
  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
    refetch: refetchHistoricalData,
  } = useMarketHistoricalData(marketid as string, rateTimeRange, volumeTimeRange);

  const setTimeRangeAndRefetch = useCallback(
    (days: number, type: 'rate' | 'volume') => {
      const endTimestamp = Math.floor(Date.now() / 1000);
      const startTimestamp = endTimestamp - days * 24 * 60 * 60;
      const newTimeRange = {
        startTimestamp,
        endTimestamp,
        interval: days > 30 ? 'DAY' : 'HOUR',
      } as TimeseriesOptions;

      if (type === 'rate') {
        setRateTimeRange(newTimeRange);
        void refetchHistoricalData.rates();
      } else {
        setVolumeTimeRange(newTimeRange);
        void refetchHistoricalData.volumes();
      }
    },
    [refetchHistoricalData],
  );

  if (isMarketLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (marketError) {
    return <div className="text-center text-red-500">Error: {(marketError as Error).message}</div>;
  }

  if (!market) {
    return <div className="text-center">Market data not available</div>;
  }

  const loanImg = findToken(market.loanAsset.address, market.morphoBlue.chain.id)?.img;
  const collateralImg = findToken(market.collateralAsset.address, market.morphoBlue.chain.id)?.img;

  const formatTime = (unixTime: number) => {
    const date = new Date(unixTime * 1000);
    if (rateTimeRange.endTimestamp - rateTimeRange.startTimestamp <= 24 * 60 * 60) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const cardStyle = 'bg-surface rounded-sm shadow-sm p-4';

  const averageLTV =
    market.state.collateralAssetsUsd && market.state.collateralAssetsUsd > 0
      ? (parseFloat(market.state.borrowAssetsUsd) / market.state.collateralAssetsUsd) * 100
      : 0;

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 pb-12 font-zen">
        <Button
          onClick={() => router.push('/markets')}
          className="bg-surface mb-4"
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
                        width={20}
                        height={20}
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
                        width={20}
                        height={20}
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
                    <OracleVendorBadge oracleData={market.oracle.data} showText />{' '}
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

        <VolumeChart
          historicalData={historicalData?.volumes}
          market={market}
          isLoading={isHistoricalLoading.volumes}
          volumeView={volumeView}
          volumeTimeframe={volumeTimeframe}
          setVolumeTimeframe={setVolumeTimeframe}
          setTimeRangeAndRefetch={setTimeRangeAndRefetch}
          formatTime={formatTime}
          setVolumeView={setVolumeView}
        />

        <RateChart
          historicalData={historicalData?.rates}
          market={market}
          isLoading={isHistoricalLoading.rates}
          apyTimeframe={apyTimeframe}
          setApyTimeframe={setApyTimeframe}
          setTimeRangeAndRefetch={setTimeRangeAndRefetch}
          formatTime={formatTime}
        />
      </div>
    </>
  );
}

export default MarketContent;
