// eslint-disable @typescript-eslint/prefer-nullish-coalescing

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { parseUnits, formatUnits } from 'viem';
import { useConnection } from 'wagmi';
import { BorrowModal } from '@/modals/borrow/borrow-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import Header from '@/components/layout/header/Header';
import { useModal } from '@/hooks/useModal';
import { useMarketData } from '@/hooks/useMarketData';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import { useTransactionFilters } from '@/stores/useTransactionFilters';
import useUserPosition from '@/hooks/useUserPosition';
import type { SupportedNetworks } from '@/utils/networks';
import { BorrowersTable } from '@/features/market-detail/components/borrowers-table';
import { BorrowsTable } from '@/features/market-detail/components/borrows-table';
import BorrowerFiltersModal from '@/features/market-detail/components/filters/borrower-filters-modal';
import { LiquidationsTable } from '@/features/market-detail/components/liquidations-table';
import { SuppliesTable } from '@/features/market-detail/components/supplies-table';
import { SuppliersTable } from '@/features/market-detail/components/suppliers-table';
import SupplierFiltersModal from '@/features/market-detail/components/filters/supplier-filters-modal';
import TransactionFiltersModal from '@/features/market-detail/components/filters/transaction-filters-modal';
import { useMarketWarnings } from '@/hooks/useMarketWarnings';
import { WarningCategory } from '@/utils/types';
import { MarketHeader } from './components/market-header';
import RateChart from './components/charts/rate-chart';
import VolumeChart from './components/charts/volume-chart';

function MarketContent() {
  // 1. Get URL params first
  const { marketid: marketId, chainId } = useParams();

  // 2. Network setup
  const network = Number(chainId as string) as SupportedNetworks;

  // 3. Consolidated state
  const { open: openModal } = useModal();
  const [showBorrowModal, setShowBorrowModal] = useState(false);
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
  } = useMarketData(marketId as string, network);

  // Transaction filters with localStorage persistence (per symbol)
  const { minSupplyAmount, minBorrowAmount, setMinSupplyAmount, setMinBorrowAmount } = useTransactionFilters(
    market?.loanAsset?.symbol ?? '',
  );

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
  } = useUserPosition(address, network, marketId as string);

  // Get all warnings for this market (hook handles undefined market)
  const allWarnings = useMarketWarnings(market);

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

  // 8. Warning filtering by category (for MarketHeader)
  const warnings = allWarnings.filter(
    (w) => w.category === WarningCategory.debt || w.category === WarningCategory.general,
  );

  // Handlers for supply/borrow actions
  const handleSupplyClick = () => {
    openModal('supply', { market, position: userPosition, isMarketPage: true, refetch: handleRefreshAllSync });
  };

  const handleBorrowClick = () => {
    setShowBorrowModal(true);
  };

  return (
    <>
      <Header />
      <div className="font-zen container h-full gap-8 pb-12">
        {/* Unified Market Header */}
        <MarketHeader
          market={market}
          marketId={marketId as string}
          network={network}
          userPosition={userPosition}
          oraclePrice={formattedOraclePrice}
          warnings={warnings}
          allWarnings={allWarnings}
          onSupplyClick={handleSupplyClick}
          onBorrowClick={handleBorrowClick}
        />

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
            <VolumeChart
              marketId={marketId as string}
              chainId={network}
              market={market}
            />

            <div className="mt-6">
              <RateChart
                marketId={marketId as string}
                chainId={network}
                market={market}
              />
            </div>
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
