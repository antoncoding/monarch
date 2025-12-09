// eslint-disable @typescript-eslint/prefer-nullish-coalescing

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardBody } from '@heroui/react';
import { ExternalLinkIcon, ChevronLeftIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { formatUnits, parseUnits } from 'viem';
import { useConnection } from 'wagmi';
import { BorrowModal } from '@/components/BorrowModal';
import { Button } from '@/components/common';
import { Spinner } from '@/components/common/Spinner';
import Header from '@/components/layout/header/Header';
import { OracleTypeInfo } from '@/components/MarketOracle';
import { SupplyModalV2 } from '@/components/SupplyModalV2';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarketData } from '@/hooks/useMarketData';
import { useMarketHistoricalData } from '@/hooks/useMarketHistoricalData';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import { useTransactionFilters } from '@/hooks/useTransactionFilters';
import useUserPositions from '@/hooks/useUserPosition';
import MORPHO_LOGO from '@/imgs/tokens/morpho.svg';
import { getExplorerURL, getMarketURL } from '@/utils/external';
import { getIRMTitle } from '@/utils/morpho';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { getTruncatedAssetName } from '@/utils/oracle';
import type { TimeseriesOptions } from '@/utils/types';
import { BorrowsTable } from './components/BorrowsTable';
import { CampaignBadge } from './components/CampaignBadge';
import { LiquidationsTable } from './components/LiquidationsTable';
import { PositionStats } from './components/PositionStats';
import { SuppliesTable } from './components/SuppliesTable';
import TransactionFiltersModal from './components/TransactionFiltersModal';
import RateChart from './RateChart';
import VolumeChart from './VolumeChart';

const NOW = Math.floor(Date.now() / 1000);
const DAY_IN_SECONDS = 24 * 60 * 60;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;

// Helper to calculate time range based on timeframe string
const calculateTimeRange = (timeframe: '1d' | '7d' | '30d'): TimeseriesOptions => {
  const endTimestamp = NOW;
  let startTimestamp;
  let interval: TimeseriesOptions['interval'] = 'HOUR';
  switch (timeframe) {
    case '1d':
      startTimestamp = endTimestamp - DAY_IN_SECONDS;
      break;
    case '30d':
      startTimestamp = endTimestamp - 30 * DAY_IN_SECONDS;
      // Use DAY interval for longer ranges if desired, adjust as needed
      interval = 'DAY';
      break;
    default:
      startTimestamp = endTimestamp - WEEK_IN_SECONDS;
      break;
  }
  return { startTimestamp, endTimestamp, interval };
};

function MarketContent() {
  // 1. Get URL params and router first
  const { marketid, chainId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 2. Network setup
  const network = Number(chainId as string) as SupportedNetworks;
  const networkImg = getNetworkImg(network);

  // 3. Consolidated state
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1d' | '7d' | '30d'>('7d');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeseriesOptions>(
    calculateTimeRange('7d'), // Initialize based on default timeframe
  );
  const [volumeView, setVolumeView] = useState<'USD' | 'Asset'>('Asset');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTransactionFiltersModal, setShowTransactionFiltersModal] = useState(false);

  // 4. Data fetching hooks - use unified time range
  const {
    data: market,
    isLoading: isMarketLoading,
    error: marketError,
    refetch: refetchMarket,
  } = useMarketData(marketid as string, network);

  console.log('market', market);

  // Transaction filters with localStorage persistence (per symbol)
  const { minSupplyAmount, minBorrowAmount, setMinSupplyAmount, setMinBorrowAmount } = useTransactionFilters(
    market?.loanAsset?.symbol ?? '',
  );

  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
    // No need for manual refetch on time change, queryKey handles it
  } = useMarketHistoricalData(marketid as string, network, selectedTimeRange); // Use selectedTimeRange

  // 5. Oracle price hook - safely handle undefined market
  const { price: oraclePrice } = useOraclePrice({
    oracle: market?.oracleAddress as `0x${string}`,
    chainId: market?.morphoBlue.chain.id,
  });

  const { address } = useConnection();

  const {
    position: userPosition,
    loading: positionLoading,
    refetch: refetchUserPosition,
  } = useUserPositions(address, network, marketid as string);

  // 6. All memoized values and callbacks
  const formattedOraclePrice = useMemo(() => {
    if (!market) return '0';
    const adjusted = (oraclePrice * BigInt(10 ** market.collateralAsset.decimals)) / BigInt(10 ** market.loanAsset.decimals);
    return formatUnits(adjusted, 36);
  }, [oraclePrice, market]);

  // convert to token amounts
  const scaledMinSupplyAmount = useMemo(() => {
    if (!market || !minSupplyAmount || minSupplyAmount === '0' || minSupplyAmount === '') {
      return '0';
    }
    try {
      return parseUnits(minSupplyAmount, market.loanAsset.decimals).toString();
    } catch {
      return '0';
    }
  }, [minSupplyAmount, market]);

  const scaledMinBorrowAmount = useMemo(() => {
    if (!market || !minBorrowAmount || minBorrowAmount === '0' || minBorrowAmount === '') {
      return '0';
    }
    try {
      return parseUnits(minBorrowAmount, market.loanAsset.decimals).toString();
    } catch {
      return '0';
    }
  }, [minBorrowAmount, market]);

  // Unified refetch function for both market and user position
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchMarket(), refetchUserPosition()]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchMarket, refetchUserPosition]);

  // Non-async wrapper for components that expect void returns
  const handleRefreshAllSync = useCallback(() => {
    void handleRefreshAll().catch((error) => {
      console.error('Failed to refresh data:', error);
    });
  }, [handleRefreshAll]);

  // Unified handler for timeframe changes
  const handleTimeframeChange = useCallback((timeframe: '1d' | '7d' | '30d') => {
    setSelectedTimeframe(timeframe);
    setSelectedTimeRange(calculateTimeRange(timeframe));
    // No explicit refetch needed, change in selectedTimeRange (part of queryKey) triggers it
  }, []);

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
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 pb-4 font-zen">
          <div className="flex h-screen items-center justify-center">
            <Spinner size={24} />
          </div>
        </div>
      </>
    );
  }

  // 8. Derived values that depend on market data
  const cardStyle = 'bg-surface rounded shadow-sm p-4';

  return (
    <>
      <Header />
      <div className="mx-auto max-w-7xl px-6 py-8 pb-4 font-zen sm:px-8 md:px-12 lg:px-16">
        {/* navigation buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            onPress={handleBackToMarkets}
            size="md"
            className="w-auto"
          >
            <ChevronLeftIcon className="mr-2" />
            <span className="hidden sm:inline">Back to Markets</span>
            <span className="sm:hidden">Back</span>
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              onPress={() => setShowSupplyModal(true)}
              className="flex-1 sm:flex-none"
            >
              Supply
            </Button>
            <Button
              onPress={() => setShowBorrowModal(true)}
              className="flex-1 sm:flex-none"
            >
              Borrow
            </Button>
            <Button
              size="md"
              className="w-full sm:w-auto"
              onPress={() => {
                void window.open(getMarketURL(market.uniqueKey, market.morphoBlue.chain.id), '_blank');
              }}
            >
              <span className="hidden sm:inline">View on Morpho</span>
              <span className="sm:hidden">Morpho</span>
              <Image
                src={MORPHO_LOGO}
                alt="Morpho Logo"
                width={20}
                height={20}
                className="ml-2"
              />
            </Button>
          </div>
        </div>

        {showSupplyModal && (
          <SupplyModalV2
            market={market}
            onOpenChange={setShowSupplyModal}
            position={userPosition}
            isMarketPage
            refetch={handleRefreshAllSync}
          />
        )}

        {showBorrowModal && (
          <BorrowModal
            market={market}
            onOpenChange={setShowBorrowModal}
            oraclePrice={oraclePrice}
            refetch={handleRefreshAllSync}
            isRefreshing={isRefreshing}
            position={userPosition}
          />
        )}

        {showTransactionFiltersModal && (
          <TransactionFiltersModal
            isOpen={showTransactionFiltersModal}
            onOpenChange={setShowTransactionFiltersModal}
            minSupplyAmount={minSupplyAmount}
            minBorrowAmount={minBorrowAmount}
            onMinSupplyChange={setMinSupplyAmount}
            onMinBorrowChange={setMinBorrowAmount}
            loanAssetSymbol={market.loanAsset.symbol}
          />
        )}

        <div className="mb-8 flex items-center justify-center gap-3">
          <h1 className="text-3xl">
            {market.loanAsset.symbol}/{market.collateralAsset.symbol} Market
          </h1>
          <CampaignBadge
            marketId={marketid as string}
            loanTokenAddress={market.loanAsset.address}
            chainId={market.morphoBlue.chain.id}
            whitelisted={market.whitelisted}
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <Card className={cardStyle}>
            <CardHeader className="flex items-center justify-between text-xl">
              <span>Basic Info</span>
              <span className="text-sm text-gray-500">
                <div className="flex items-center">
                  {networkImg && (
                    <Image
                      src={networkImg}
                      alt={network.toString()}
                      width={18}
                      height={18}
                      className="mr-2"
                    />
                  )}
                  {getNetworkName(network)}
                </div>
              </span>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
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
                      {getTruncatedAssetName(market.loanAsset.symbol)} <ExternalLinkIcon className="ml-1" />
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
                      href={getExplorerURL(market.collateralAsset.address, market.morphoBlue.chain.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center no-underline hover:underline"
                    >
                      {getTruncatedAssetName(market.collateralAsset.symbol)} <ExternalLinkIcon className="ml-1" />
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
                <div className="flex items-center justify-between">
                  <span>LLTV:</span>
                  <span>{formatUnits(BigInt(market.lltv), 16)}%</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={cardStyle}>
            <CardHeader className="flex items-center justify-between text-xl">
              <span>Oracle Info</span>

              <span className="text-sm text-gray-500">
                <Link
                  href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center hover:underline"
                >
                  <ExternalLinkIcon className="ml-1" />
                </Link>
              </span>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Live Price:</span>
                  <span className="text-sm text-secondary">
                    {Number(formattedOraclePrice).toFixed(4)} {market.loanAsset.symbol}
                  </span>
                </div>
                <OracleTypeInfo
                  oracleData={market.oracle?.data}
                  oracleAddress={market.oracleAddress}
                  chainId={market.morphoBlue.chain.id}
                />
              </div>
            </CardBody>
          </Card>

          <PositionStats
            market={market}
            userPosition={userPosition}
            positionLoading={positionLoading}
            cardStyle={cardStyle}
            onRefresh={handleRefreshAllSync}
            isRefreshing={isRefreshing}
          />
        </div>

        <h4 className="pt-4 text-2xl">Volume</h4>
        <VolumeChart
          historicalData={historicalData?.volumes}
          market={market}
          selectedTimeRange={selectedTimeRange}
          isLoading={isHistoricalLoading}
          volumeView={volumeView}
          selectedTimeframe={selectedTimeframe}
          handleTimeframeChange={handleTimeframeChange}
          setVolumeView={setVolumeView}
        />

        <h4 className="pt-4 text-2xl">Rates</h4>
        <RateChart
          historicalData={historicalData?.rates}
          market={market}
          selectedTimeRange={selectedTimeRange}
          isLoading={isHistoricalLoading}
          selectedTimeframe={selectedTimeframe}
          handleTimeframeChange={handleTimeframeChange}
        />

        <h4 className="pt-4 text-2xl">Activities</h4>

        {/* divider */}
        <div className="my-4 h-[2px] w-full bg-gray-200 dark:bg-gray-800" />
        <SuppliesTable
          chainId={network}
          market={market}
          minAssets={scaledMinSupplyAmount}
          onOpenFiltersModal={() => setShowTransactionFiltersModal(true)}
        />
        <BorrowsTable
          chainId={network}
          market={market}
          minAssets={scaledMinBorrowAmount}
          onOpenFiltersModal={() => setShowTransactionFiltersModal(true)}
        />
        <LiquidationsTable
          chainId={network}
          market={market}
        />
      </div>
    </>
  );
}

export default MarketContent;
