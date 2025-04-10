'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardBody } from '@nextui-org/card';
import { ExternalLinkIcon, ChevronLeftIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { formatUnits } from 'viem';
import { BorrowModal } from '@/components/BorrowModal';
import { Button } from '@/components/common';
import { Spinner } from '@/components/common/Spinner';
import { OracleFeedInfo } from '@/components/FeedInfo/OracleFeedInfo';
import Header from '@/components/layout/header/Header';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { SupplyModalV2 } from '@/components/SupplyModalV2';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarket, useMarketHistoricalData } from '@/hooks/useMarket';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import MORPHO_LOGO from '@/imgs/tokens/morpho.svg';
import { getExplorerURL, getMarketURL } from '@/utils/external';
import { getIRMTitle } from '@/utils/morpho';
import { getNetworkImg, getNetworkName, SupportedNetworks } from '@/utils/networks';
import { TimeseriesOptions } from '@/utils/types';
import { BorrowsTable } from './components/BorrowsTable';
import { LiquidationsTable } from './components/LiquidationsTable';
import { SuppliesTable } from './components/SuppliesTable';
import RateChart from './RateChart';
import VolumeChart from './VolumeChart';

const NOW = Math.floor(Date.now() / 1000);
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

function MarketContent() {
  // 1. Get URL params and router first
  const { marketid, chainId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 2. Network setup
  const network = Number(chainId as string) as SupportedNetworks;
  const networkImg = getNetworkImg(network);

  // 3. All useState hooks grouped together
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [apyTimeframe, setApyTimeframe] = useState<'1day' | '7day' | '30day'>('7day');
  const [volumeTimeframe, setVolumeTimeframe] = useState<'1day' | '7day' | '30day'>('7day');
  const [volumeView, setVolumeView] = useState<'USD' | 'Asset'>('USD');
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

  // 4. Data fetching hooks
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

  // 5. Oracle price hook - safely handle undefined market
  const { price: oraclePrice } = useOraclePrice({
    oracle: market?.oracleAddress as `0x${string}`,
    chainId: market?.morphoBlue.chain.id,
  });

  // 6. All memoized values and callbacks
  const formattedOraclePrice = useMemo(() => {
    if (!market) return '0';
    const adjusted =
      (oraclePrice * BigInt(10 ** market.collateralAsset.decimals)) /
      BigInt(10 ** market.loanAsset.decimals);
    return formatUnits(adjusted, 36);
  }, [oraclePrice, market]);

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

  const handleBackToMarkets = useCallback(() => {
    const currentParams = searchParams.toString();
    const marketsPath = '/markets';
    const targetPath = currentParams ? `${marketsPath}?${currentParams}` : marketsPath;
    router.push(targetPath);
  }, [router, searchParams]);

  // 7. Early returns for loading/error states
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

  // 8. Derived values that depend on market data
  const cardStyle = 'bg-surface rounded shadow-sm p-4';
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

          <div className="flex gap-2">
            <Button onClick={() => setShowSupplyModal(true)}>Supply</Button>
            <Button onClick={() => setShowBorrowModal(true)}>Borrow</Button>
            <Button
              size="md"
              className="mb-4"
              onClick={() =>
                window.open(getMarketURL(market.uniqueKey, market.morphoBlue.chain.id), '_blank')
              }
            >
              View on Morpho
              <Image src={MORPHO_LOGO} alt="Morpho Logo" width={20} height={20} className="ml-2" />
            </Button>
          </div>
        </div>

        {showSupplyModal && (
          <SupplyModalV2 market={market} onClose={() => setShowSupplyModal(false)} isMarketPage />
        )}

        {showBorrowModal && (
          <BorrowModal market={market} onClose={() => setShowBorrowModal(false)} />
        )}

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
                  <div className="flex items-center gap-2">
                    <TokenIcon
                      address={market.loanAsset.address}
                      chainId={market.morphoBlue.chain.id}
                      symbol={market.loanAsset.symbol}
                      width={20}
                      height={20}
                    />
                    <Link
                      href={getExplorerURL(market.loanAsset.address, market.morphoBlue.chain.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center no-underline hover:underline"
                    >
                      {market.loanAsset.symbol} <ExternalLinkIcon className="ml-1" />
                    </Link>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Collateral Asset:</span>
                  <div className="flex items-center gap-2">
                    <TokenIcon
                      address={market.collateralAsset.address}
                      chainId={market.morphoBlue.chain.id}
                      symbol={market.collateralAsset.symbol}
                      width={20}
                      height={20}
                    />
                    <Link
                      href={getExplorerURL(
                        market.collateralAsset.address,
                        market.morphoBlue.chain.id,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center no-underline hover:underline"
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
                    className="flex items-center no-underline hover:underline"
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
                <div className="flex items-center justify-between">
                  <span>Live Price:</span>
                  <span className="text-sm text-secondary">
                    {Number(formattedOraclePrice).toFixed(4)} {market.loanAsset.symbol}
                  </span>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Feed Routes:</h4>
                  {market.oracle.data && (
                    <div>
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
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <h4 className="pt-4 text-2xl font-semibold">Volume</h4>
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

        <h4 className="pt-4 text-2xl font-semibold">Rates</h4>
        <RateChart
          historicalData={historicalData?.rates}
          market={market}
          rateTimeRange={rateTimeRange}
          isLoading={isHistoricalLoading.rates}
          apyTimeframe={apyTimeframe}
          setApyTimeframe={setApyTimeframe}
          setTimeRangeAndRefetch={setTimeRangeAndRefetch}
        />

        <h4 className="pt-4 text-2xl font-semibold">Activities </h4>

        {/* divider */}
        <div className="my-4 h-[2px] w-full bg-gray-200 dark:bg-gray-800" />
        <SuppliesTable chainId={network} market={market} />
        <BorrowsTable chainId={network} market={market} />
        <LiquidationsTable chainId={network} market={market} />
      </div>
    </>
  );
}

export default MarketContent;
