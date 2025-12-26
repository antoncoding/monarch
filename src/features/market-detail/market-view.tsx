// eslint-disable @typescript-eslint/prefer-nullish-coalescing

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatUnits, parseUnits } from 'viem';
import { useConnection } from 'wagmi';
import { BorrowModal } from '@/modals/borrow/borrow-modal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import Header from '@/components/layout/header/Header';
import { OracleTypeInfo } from '@/features/markets/components/oracle';
import { TokenIcon } from '@/components/shared/token-icon';
import { useModal } from '@/hooks/useModal';
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
import { BorrowersTable } from '@/features/market-detail/components/borrowers-table';
import { BorrowsTable } from '@/features/market-detail/components/borrows-table';
import BorrowerFiltersModal from '@/features/market-detail/components/filters/borrower-filters-modal';
import { CampaignBadge } from '@/features/market-detail/components/campaign-badge';
import { LiquidationsTable } from '@/features/market-detail/components/liquidations-table';
import { PositionStats } from '@/features/market-detail/components/position-stats';
import { SuppliesTable } from '@/features/market-detail/components/supplies-table';
import { SuppliersTable } from '@/features/market-detail/components/suppliers-table';
import SupplierFiltersModal from '@/features/market-detail/components/filters/supplier-filters-modal';
import TransactionFiltersModal from '@/features/market-detail/components/filters/transaction-filters-modal';
import RateChart from './components/charts/rate-chart';
import VolumeChart from './components/charts/volume-chart';

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
  // 1. Get URL params first
  const { marketid, chainId } = useParams();

  // 2. Network setup
  const network = Number(chainId as string) as SupportedNetworks;
  const networkImg = getNetworkImg(network);

  // 3. Consolidated state
  const { open: openModal } = useModal();
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1d' | '7d' | '30d'>('7d');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeseriesOptions>(
    calculateTimeRange('7d'), // Initialize based on default timeframe
  );
  const [volumeView, setVolumeView] = useState<'USD' | 'Asset'>('Asset');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTransactionFiltersModal, setShowTransactionFiltersModal] = useState(false);
  const [showSupplierFiltersModal, setShowSupplierFiltersModal] = useState(false);
  const [minSupplierShares, setMinSupplierShares] = useState('0');
  const [showBorrowerFiltersModal, setShowBorrowerFiltersModal] = useState(false);
  const [minBorrowerShares, setMinBorrowerShares] = useState('0');

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

  // Convert user-specified asset amount to shares for filtering suppliers
  // Formula: effectiveMinShares = (minAssetAmount × totalSupplyShares) / totalSupplyAssets
  const scaledMinSupplierShares = useMemo(() => {
    if (!market || !minSupplierShares || minSupplierShares === '0' || minSupplierShares === '') {
      return '0';
    }
    try {
      const minAssetAmount = parseUnits(minSupplierShares, market.loanAsset.decimals);
      const totalSupplyAssets = BigInt(market.state.supplyAssets);
      const totalSupplyShares = BigInt(market.state.supplyShares);

      // If no supply yet, return 0
      if (totalSupplyAssets === 0n) {
        return '0';
      }

      // Convert asset amount to shares
      const effectiveMinShares = (minAssetAmount * totalSupplyShares) / totalSupplyAssets;
      return effectiveMinShares.toString();
    } catch {
      return '0';
    }
  }, [minSupplierShares, market]);

  // Convert user-specified asset amount to shares for filtering borrowers
  // Formula: effectiveMinShares = (minAssetAmount × totalBorrowShares) / totalBorrowAssets
  const scaledMinBorrowerShares = useMemo(() => {
    if (!market || !minBorrowerShares || minBorrowerShares === '0' || minBorrowerShares === '') {
      return '0';
    }
    try {
      const minAssetAmount = parseUnits(minBorrowerShares, market.loanAsset.decimals);
      const totalBorrowAssets = BigInt(market.state.borrowAssets);
      const totalBorrowShares = BigInt(market.state.borrowShares);

      // If no borrows yet, return 0
      if (totalBorrowAssets === 0n) {
        return '0';
      }

      // Convert asset amount to shares
      const effectiveMinShares = (minAssetAmount * totalBorrowShares) / totalBorrowAssets;
      return effectiveMinShares.toString();
    } catch {
      return '0';
    }
  }, [minBorrowerShares, market]);

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
      <div className="mx-auto max-w-7xl px-6 py-4 pb-4 font-zen sm:px-8 md:px-12 lg:px-16">
        {/* Market title and actions */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {market.loanAsset.symbol}/{market.collateralAsset.symbol} Market
            </h1>
            <CampaignBadge
              marketId={marketid as string}
              loanTokenAddress={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              whitelisted={market.whitelisted}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => openModal('supply', { market, position: userPosition, isMarketPage: true, refetch: handleRefreshAllSync })}
              className="flex-1 sm:flex-none"
            >
              Supply
            </Button>
            <Button
              onClick={() => setShowBorrowModal(true)}
              className="flex-1 sm:flex-none"
            >
              Borrow
            </Button>
            <Button
              size="md"
              className="w-full sm:w-auto"
              onClick={() => {
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

        {showSupplierFiltersModal && (
          <SupplierFiltersModal
            isOpen={showSupplierFiltersModal}
            onOpenChange={setShowSupplierFiltersModal}
            minShares={minSupplierShares}
            onMinSharesChange={setMinSupplierShares}
            loanAssetSymbol={market.loanAsset.symbol}
          />
        )}

        {showBorrowerFiltersModal && (
          <BorrowerFiltersModal
            isOpen={showBorrowerFiltersModal}
            onOpenChange={setShowBorrowerFiltersModal}
            minShares={minBorrowerShares}
            onMinSharesChange={setMinBorrowerShares}
            loanAssetSymbol={market.loanAsset.symbol}
          />
        )}

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <Card className={cardStyle}>
            <CardHeader className="flex flex-row items-center justify-between text-xl">
              <span>Basic Info</span>
              <div className="flex items-center text-sm text-gray-500">
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
            <CardHeader className="flex flex-row items-center justify-between text-xl">
              <span>Oracle Info</span>
              <Link
                href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-gray-500 hover:underline"
              >
                <ExternalLinkIcon />
              </Link>
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

        {/* Tabs Section */}
        <Tabs
          defaultValue="statistics"
          className="mt-8 w-full"
        >
          <TabsList>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="statistics">
            <h4 className="mb-4 text-lg text-secondary">Volume</h4>
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

            <h4 className="mb-4 mt-8 text-lg text-secondary">Rates</h4>
            <RateChart
              historicalData={historicalData?.rates}
              market={market}
              selectedTimeRange={selectedTimeRange}
              isLoading={isHistoricalLoading}
              selectedTimeframe={selectedTimeframe}
              handleTimeframeChange={handleTimeframeChange}
            />
          </TabsContent>

          <TabsContent value="activities">
            <SuppliesTable
              chainId={network}
              market={market}
              minAssets={scaledMinSupplyAmount}
              onOpenFiltersModal={() => setShowTransactionFiltersModal(true)}
            />
            <div className="mt-6">
              <BorrowsTable
                chainId={network}
                market={market}
                minAssets={scaledMinBorrowAmount}
                onOpenFiltersModal={() => setShowTransactionFiltersModal(true)}
              />
            </div>
            <div className="mt-6">
              <LiquidationsTable
                chainId={network}
                market={market}
              />
            </div>
          </TabsContent>

          <TabsContent value="positions">
            <SuppliersTable
              chainId={network}
              market={market}
              minShares={scaledMinSupplierShares}
              onOpenFiltersModal={() => setShowSupplierFiltersModal(true)}
            />
            <div className="mt-6">
              <BorrowersTable
                chainId={network}
                market={market}
                minShares={scaledMinBorrowerShares}
                oraclePrice={oraclePrice}
                onOpenFiltersModal={() => setShowBorrowerFiltersModal(true)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

export default MarketContent;
