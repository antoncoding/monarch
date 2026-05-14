'use client';

import { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { IoIosSwap } from 'react-icons/io';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { AccountIdentity } from '@/components/shared/account-identity';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { usePortfolioValue } from '@/hooks/usePortfolioValue';
import { useUserVaultsV2Query } from '@/hooks/queries/useUserVaultsV2Query';
import { useVaultHistoricalApy } from '@/hooks/useVaultHistoricalApy';
import { useVaultAccountIdentity } from '@/hooks/useVaultAccountIdentity';
import { useModal } from '@/hooks/useModal';
import { usePositionsFilters } from '@/stores/usePositionsFilters';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { SuppliedMorphoBlueGroupedTable } from './components/supplied-morpho-blue-grouped-table';
import { BorrowedMorphoBlueTable } from './components/borrowed-morpho-blue-table';
import { PortfolioValueBadge } from './components/portfolio-value-badge';
import { UserVaultsTable } from './components/user-vaults-table';
import { AccountVaultInfo } from './components/account-vault-info';
import { VaultManagedExposures } from './components/adapter-managed-exposure';
import { PositionBreadcrumbs } from '@/features/position-detail/components/position-breadcrumbs';
import { hasSupplyPositionHistory } from '@/utils/positions';

export default function Positions() {
  const { account } = useParams<{ account: string }>();
  const { open } = useModal();
  const period = usePositionsFilters((s) => s.period);
  const { addVisitedAddress, toggleAddressBookmark, isAddressBookmarked } = usePortfolioBookmarks();
  const accountVaultIdentity = useVaultAccountIdentity(account);
  const isV2VaultPage = accountVaultIdentity?.kind === 'vault-v2';
  const showNativeAccountSections = !isV2VaultPage;

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
  } = useUserPositionsSummaryData(account, period, undefined, { enabled: showNativeAccountSections });

  // Fetch user's auto vaults
  const {
    data: vaults = [],
    isLoading: isVaultsLoading,
    isRefetching: isVaultsRefetching,
    refetch: refetchVaults,
  } = useUserVaultsV2Query({ userAddress: account as Address, enabled: showNativeAccountSections });

  // Fetch historical APY for vaults
  const { data: vaultApyData, isLoading: isVaultApyLoading } = useVaultHistoricalApy(vaults, period);

  // Merge APY data into vaults
  const vaultsWithApy = useMemo(() => {
    if (!vaultApyData) return vaults;
    return vaults.map((vault) => ({
      ...vault,
      actualApy: vaultApyData.get(vault.address.toLowerCase())?.actualApy,
    }));
  }, [vaults, vaultApyData]);

  // Calculate portfolio value from positions and vaults
  const {
    totalUsd,
    totalDebtUsd,
    assetBreakdown,
    debtBreakdown,
    isLoading: isPricesLoading,
    error: pricesError,
  } = usePortfolioValue(marketPositions, vaults);

  const loading = showNativeAccountSections && (isMarketsLoading || isPositionsLoading);

  const loadingMessage = isMarketsLoading ? 'Loading markets...' : 'Loading user positions...';

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
        <div className="mt-3 flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AccountIdentity
                address={account as Address}
                variant="full"
                showAddress
                chainId={accountVaultIdentity?.chainId}
              />
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 px-1 text-secondary hover:text-primary hover:bg-transparent"
                aria-label={isBookmarked ? 'Remove address bookmark' : 'Bookmark address'}
                onClick={() => toggleAddressBookmark(account as Address)}
              >
                {isBookmarked ? <RiBookmarkFill className="h-4 w-4" /> : <RiBookmarkLine className="h-4 w-4" />}
              </Button>
            </div>
            <AccountVaultInfo account={account as Address} />
          </div>
          <div className="flex flex-wrap items-center gap-0">
            {showHeaderPortfolio && (
              <PortfolioValueBadge
                totalUsd={totalUsd}
                totalDebtUsd={totalDebtUsd}
                assetBreakdown={assetBreakdown}
                debtBreakdown={debtBreakdown}
                isLoading={isPricesLoading}
                error={pricesError}
              />
            )}
            <div className={`flex items-center gap-2 ${showHeaderPortfolio ? 'ml-8 border-l border-dashed border-border/70 pl-8' : ''}`}>
              <Button
                variant="default"
                onClick={() => open('bridgeSwap', {})}
                title="Swap tokens"
              >
                <IoIosSwap className="h-4 w-4" />
                Swap
              </Button>
            </div>
          </div>
        </div>

        {accountVaultIdentity?.kind === 'vault-v2' && accountVaultIdentity.adapterAddress && (
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
              account={account}
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
