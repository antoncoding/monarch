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
import { useModal } from '@/hooks/useModal';
import { usePositionsFilters } from '@/stores/usePositionsFilters';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { SuppliedMorphoBlueGroupedTable } from './components/supplied-morpho-blue-grouped-table';
import { BorrowedMorphoBlueTable } from './components/borrowed-morpho-blue-table';
import { PortfolioValueBadge } from './components/portfolio-value-badge';
import { UserVaultsTable } from './components/user-vaults-table';
import { PositionBreadcrumbs } from '@/features/position-detail/components/position-breadcrumbs';
import { SupportedNetworks } from '@/utils/networks';

export default function Positions() {
  const { account } = useParams<{ account: string }>();
  const { open } = useModal();
  const period = usePositionsFilters((s) => s.period);
  const { addVisitedAddress, toggleAddressBookmark, isAddressBookmarked } = usePortfolioBookmarks();

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
  } = useUserPositionsSummaryData(account, period);

  // Fetch user's auto vaults
  const {
    data: vaults = [],
    isLoading: isVaultsLoading,
    isRefetching: isVaultsRefetching,
    refetch: refetchVaults,
  } = useUserVaultsV2Query({ userAddress: account as Address });

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

  const loading = isMarketsLoading || isPositionsLoading;

  const loadingMessage = isMarketsLoading ? 'Loading markets...' : 'Loading user positions...';

  const hasSuppliedMarkets = marketPositions.some((position) => BigInt(position.state.supplyShares) > 0n);
  const hasBorrowPositions = marketPositions.some(
    (position) => BigInt(position.state.borrowShares) > 0n || BigInt(position.state.collateral) > 0n,
  );
  const hasVaults = vaults && vaults.length > 0;
  const showEmpty = !loading && !isVaultsLoading && !hasSuppliedMarkets && !hasBorrowPositions && !hasVaults;
  const isBookmarked = isAddressBookmarked(account as Address);

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
          <div className="flex items-center gap-2">
            <AccountIdentity
              address={account as Address}
              variant="full"
              showAddress
              chainId={SupportedNetworks.Mainnet}
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
          <div className="flex flex-wrap items-center gap-3">
            {!loading && (
              <PortfolioValueBadge
                totalUsd={totalUsd}
                totalDebtUsd={totalDebtUsd}
                assetBreakdown={assetBreakdown}
                debtBreakdown={debtBreakdown}
                isLoading={isPricesLoading}
                error={pricesError}
              />
            )}
            <div className={`flex items-center gap-2 ${loading ? '' : 'ml-2 border-l border-dashed border-border/70 pl-4'}`}>
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
