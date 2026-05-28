'use client';

import { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import type { Address } from 'viem';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { usePortfolioValue } from '@/hooks/usePortfolioValue';
import { useUserVaultsV2Query } from '@/hooks/queries/useUserVaultsV2Query';
import { useVaultHistoricalApy } from '@/hooks/useVaultHistoricalApy';
import { useVaultAccountIdentity } from '@/hooks/useVaultAccountIdentity';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { useModal } from '@/hooks/useModal';
import { usePositionsFilters } from '@/stores/usePositionsFilters';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { SuppliedMorphoBlueGroupedTable } from './components/supplied-morpho-blue-grouped-table';
import { BorrowedMorphoBlueTable } from './components/borrowed-morpho-blue-table';
import { PortfolioAnalyticsBanner } from './components/portfolio-analytics-banner';
import { UserVaultsTable } from './components/user-vaults-table';
import { VaultManagedExposures } from './components/adapter-managed-exposure';
import { PositionBreadcrumbs } from '@/features/position-detail/components/position-breadcrumbs';
import { hasSupplyPositionHistory } from '@/utils/positions';

export default function Positions() {
  const { account } = useParams<{ account: string }>();
  const { open } = useModal();
  const period = usePositionsFilters((s) => s.period);
  const setPeriod = usePositionsFilters((s) => s.setPeriod);
  const { addVisitedAddress, toggleAddressBookmark, isAddressBookmarked } = usePortfolioBookmarks();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const { loading: isVaultRegistryLoading } = useVaultRegistry();
  const accountVaultIdentity = useVaultAccountIdentity(account);
  const isV2VaultPage = accountVaultIdentity?.kind === 'vault-v2';
  const canEvaluateVaultIdentity = !isVaultRegistryLoading;
  // Start native account fetches during identity resolution, but keep native UI hidden until vault status is known.
  const shouldFetchNativeAccountData = !isV2VaultPage;
  const showNativeAccountSections = canEvaluateVaultIdentity && shouldFetchNativeAccountData;

  const { loading: isMarketsLoading } = useProcessedMarkets();

  const {
    isPositionsLoading,
    positions: marketPositions,
    refetch: refetchPositions,
    isRefetching: isPositionsRefetching,
    isEarningsLoading,
    actualBlockData,
    transactions,
    snapshotsByChain,
    earningsRangesByChain,
  } = useUserPositionsSummaryData(account, period, undefined, { enabled: shouldFetchNativeAccountData });

  // Fetch user's auto vaults
  const {
    data: vaults = [],
    isLoading: isVaultsLoading,
    isRefetching: isVaultsRefetching,
    refetch: refetchVaults,
  } = useUserVaultsV2Query({ userAddress: account as Address, enabled: shouldFetchNativeAccountData });

  // Fetch historical APY for vaults
  const { data: vaultApyData, isLoading: isVaultApyLoading } = useVaultHistoricalApy(vaults, period);

  // Merge APY data into vaults
  const vaultsWithApy = useMemo(() => {
    if (!vaultApyData) return vaults;
    return vaults.map((vault) => {
      const periodData = vaultApyData.get(vault.address.toLowerCase());

      return {
        ...vault,
        actualApy: periodData?.actualApy,
        earnedAssets: periodData?.earnedAssets,
      };
    });
  }, [vaults, vaultApyData]);

  // Calculate portfolio value from positions and vaults
  const {
    totalUsd,
    totalDebtUsd,
    assetBreakdown,
    debtBreakdown,
    portfolioAnalytics,
    isLoading: isPricesLoading,
    error: pricesError,
  } = usePortfolioValue(marketPositions, vaults, earningsRangesByChain);

  const loading = !canEvaluateVaultIdentity || (showNativeAccountSections && (isMarketsLoading || isPositionsLoading));

  const loadingMessage = canEvaluateVaultIdentity
    ? isMarketsLoading
      ? 'Loading markets...'
      : 'Loading user positions...'
    : 'Loading account metadata...';

  const hasSuppliedMarkets = showNativeAccountSections && marketPositions.some(hasSupplyPositionHistory);
  const hasBorrowPositions =
    showNativeAccountSections &&
    marketPositions.some((position) => BigInt(position.state.borrowShares) > 0n || BigInt(position.state.collateral) > 0n);
  const hasVaults = showNativeAccountSections && vaults && vaults.length > 0;
  const showEmpty = showNativeAccountSections && !loading && !isVaultsLoading && !hasSuppliedMarkets && !hasBorrowPositions && !hasVaults;
  const isBookmarked = isAddressBookmarked(account as Address);
  const showHeaderPortfolio = showNativeAccountSections && !loading;

  useEffect(() => {
    if (account) {
      addVisitedAddress(account);
    }
  }, [account, addVisitedAddress]);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8">
        <div className="mt-6 min-h-10 flex items-center">
          <PositionBreadcrumbs
            userAddress={account}
            showPosition={false}
          />
        </div>
        <div className="mt-3 pb-4">
          <PortfolioAnalyticsBanner
            account={account}
            accountChainId={accountVaultIdentity?.chainId}
            isBookmarked={isBookmarked}
            onToggleBookmark={() => toggleAddressBookmark(account as Address)}
            period={period}
            onPeriodChange={setPeriod}
            rateLabel={rateLabel}
            isAprDisplay={isAprDisplay}
            totalUsd={totalUsd}
            totalDebtUsd={totalDebtUsd}
            assetBreakdown={assetBreakdown}
            debtBreakdown={debtBreakdown}
            portfolioAnalytics={portfolioAnalytics}
            isValueLoading={isPricesLoading}
            isEarningsLoading={isEarningsLoading}
            valueError={pricesError}
            showPortfolioStats={showHeaderPortfolio}
            onSwap={() => open('bridgeSwap', {})}
          />
        </div>

        {accountVaultIdentity?.kind === 'vault-v2' && (
          <VaultManagedExposures
            vaultAddress={account as Address}
            fallbackAdapterAddress={accountVaultIdentity.adapterAddress}
            fallbackAdapterType={accountVaultIdentity.adapterType}
            chainId={accountVaultIdentity.chainId}
            period={period}
          />
        )}

        <div className="space-y-6 mt-2 pb-20">
          {/* Loading state for initial page load */}
          {loading && (
            <LoadingScreen
              message={loadingMessage}
              className="mt-10"
            />
          )}

          {/* Morpho Blue Positions Section */}
          {!loading && hasSuppliedMarkets && (
            <SuppliedMorphoBlueGroupedTable
              account={account}
              positions={marketPositions}
              refetch={refetchPositions}
              isRefetching={isPositionsRefetching}
              isEarningsLoading={isEarningsLoading}
              actualBlockData={actualBlockData}
              transactions={transactions}
              snapshotsByChain={snapshotsByChain}
            />
          )}
          {!loading && hasBorrowPositions && (
            <BorrowedMorphoBlueTable
              account={account}
              positions={marketPositions}
              onRefetch={refetchPositions}
              isRefetching={isPositionsRefetching}
            />
          )}

          {/* Auto Vaults Section (progressive loading) */}
          {isVaultsLoading && !loading && (
            <LoadingScreen
              message="Loading vaults..."
              className="mt-10"
            />
          )}

          {!isVaultsLoading && hasVaults && (
            <UserVaultsTable
              vaults={vaultsWithApy}
              period={period}
              isEarningsLoading={isVaultApyLoading}
              refetch={() => void refetchVaults()}
              isRefetching={isVaultsRefetching}
            />
          )}

          {/* Empty state (only if both finished loading and both empty) */}
          {showEmpty && (
            <EmptyScreen
              message="No open positions."
              className="mt-10"
            />
          )}
        </div>
      </div>
    </div>
  );
}
