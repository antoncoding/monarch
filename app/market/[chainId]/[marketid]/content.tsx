'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardBody } from '@nextui-org/card';
import { ExternalLinkIcon, ChevronLeftIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { formatUnits } from 'viem';
import { Button } from '@/components/common';
import { Spinner } from '@/components/common/Spinner';
import { OracleFeedInfo } from '@/components/FeedInfo/OracleFeedInfo';
import Header from '@/components/layout/header/Header';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { useMarket, useMarketHistoricalData } from '@/hooks/useMarket';
import MORPHO_LOGO from '@/imgs/tokens/morpho.svg';
import { getExplorerURL, getMarketURL } from '@/utils/external';
import { getIRMTitle } from '@/utils/morpho';
import { getNetworkImg, getNetworkName, SupportedNetworks } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { TimeseriesOptions } from '@/utils/types';
import RateChart from './RateChart';
import VolumeChart from './VolumeChart';

const NOW = Math.floor(Date.now() / 1000);
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

function MarketContent() {
  const { marketid, chainId } = useParams();

  const network = Number(chainId as string) as SupportedNetworks;
  const networkImg = getNetworkImg(network);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [rateTimeRange, setRateTimeRange] = useState<TimeseriesOptions>({
    startTimestamp: NOW - WEEK_IN_SECONDS,
    endTimestamp: NOW,
    interval: 'HOUR',
  });
  const [volumeTimeRange, setVolumeTimeRange] = useState<TimeseriesOptions>({
    startTimestamp: NOW - WEEK_IN_SECONDS,
    endTimestamp: NOW,
    interval: 'HOUR',
  });
  const [apyTimeframe, setApyTimeframe] = useState<'1day' | '7day' | '30day'>('7day');
  const [volumeTimeframe, setVolumeTimeframe] = useState<'1day' | '7day' | '30day'>('7day');
  const [volumeView, setVolumeView] = useState<'USD' | 'Asset'>('USD');

  const {
    data: market,
    isLoading: isMarketLoading,
    error: marketError,
  } = useMarket(marketid as string, network);
  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
    refetch: refetchHistoricalData,
  } = useMarketHistoricalData(marketid as string, network, rateTimeRange, volumeTimeRange);

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
    [refetchHistoricalData, setRateTimeRange, setVolumeTimeRange],
  );

  const handleBackToMarkets = () => {
    // Preserve all current search parameters when going back
    const currentParams = searchParams.toString();
    const marketsPath = '/markets';

    // If we have query params, append them to the markets URL
    const targetPath = currentParams ? `${marketsPath}?${currentParams}` : marketsPath;

    router.push(targetPath);
  };

  if (isMarketLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={24} />
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

  const cardStyle = 'bg-surface rounded-md shadow-sm p-4';

  const averageLTV =
    !market.state.collateralAssetsUsd ||
    !market.state.borrowAssetsUsd ||
    market.state.collateralAssetsUsd <= 0
      ? 0
      : (parseFloat(market.state.borrowAssetsUsd) / market.state.collateralAssetsUsd) * 100;

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 pb-4 font-zen">
        {/* navigation bottons */}
        <div className="flex justify-between">
          <Button onClick={handleBackToMarkets} size="md" className="mb-4">
            <ChevronLeftIcon className="mr-2" />
            Back to Markets
          </Button>

          <Button
            size="md"
            className="mb-4"
            onClick={() =>
              window.open(getMarketURL(market.uniqueKey, market.morphoBlue.chain.id), '_blank')
            }
          >
            View on Morpho Blue
            <Image src={MORPHO_LOGO} alt="Morpho Logo" width={20} height={20} className="ml-2" />
          </Button>
        </div>

        <h1 className="mb-8 text-center text-3xl">
          {market.loanAsset.symbol}/{market.collateralAsset.symbol} Market
        </h1>

        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          <Card className={cardStyle}>
            <CardHeader className="text-xl">Basic Info</CardHeader>
            <CardBody>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Network:</span>
                  <div className="flex items-center">
                    {networkImg && (
                      <Image
                        src={networkImg}
                        alt={network.toString()}
                        width={20}
                        height={20}
                        className="mr-2"
                      />
                    )}
                    {getNetworkName(network)}
                  </div>
                </div>
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
                  {market.oracle.data && (
                    <Link
                      href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center hover:underline"
                    >
                      <OracleVendorBadge oracleData={market.oracle.data} showText />{' '}
                      <ExternalLinkIcon className="ml-1" />
                    </Link>
                  )}
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Feed Routes:</h4>
                  {market.oracle.data && (
                    <div>
                      {' '}
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
                      />{' '}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <VolumeChart
          historicalData={historicalData?.volumes}
          market={market}
          volumeTimeRange={volumeTimeRange}
          isLoading={isHistoricalLoading.volumes}
          volumeView={volumeView}
          volumeTimeframe={volumeTimeframe}
          setVolumeTimeframe={setVolumeTimeframe}
          setTimeRangeAndRefetch={setTimeRangeAndRefetch}
          setVolumeView={setVolumeView}
        />

        <RateChart
          historicalData={historicalData?.rates}
          market={market}
          rateTimeRange={rateTimeRange}
          isLoading={isHistoricalLoading.rates}
          apyTimeframe={apyTimeframe}
          setApyTimeframe={setApyTimeframe}
          setTimeRangeAndRefetch={setTimeRangeAndRefetch}
        />
      </div>
    </>
  );
}

export default MarketContent;
