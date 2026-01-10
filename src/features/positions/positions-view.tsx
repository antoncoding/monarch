'use client';

import { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IoIosSwap } from 'react-icons/io';
import { GoHistory } from 'react-icons/go';
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
import { useModal } from '@/hooks/useModal';
import { SuppliedMorphoBlueGroupedTable } from './components/supplied-morpho-blue-grouped-table';
import { PortfolioValueBadge } from './components/portfolio-value-badge';
import { UserVaultsTable } from './components/user-vaults-table';

export default function Positions() {
  const { account } = useParams<{ account: string }>();
  const { open } = useModal();

  const { loading: isMarketsLoading } = useProcessedMarkets();

  const { isPositionsLoading, positions: marketPositions } = useUserPositionsSummaryData(account, 'day');

  // Fetch user's auto vaults
  const {
    data: vaults = [],
    isLoading: isVaultsLoading,
    isRefetching: isVaultsRefetching,
    refetch: refetchVaults,
  } = useUserVaultsV2Query({ userAddress: account as Address });

  console.log('User vaults:', isVaultsLoading, vaults);

  const router = useRouter();

  // Calculate portfolio value from positions and vaults
  const { totalUsd, assetBreakdown, isLoading: isPricesLoading, error: pricesError } = usePortfolioValue(marketPositions, vaults);

  const loading = isMarketsLoading || isPositionsLoading;

  const loadingMessage = isMarketsLoading ? 'Loading markets...' : 'Loading user positions...';

  const hasSuppliedMarkets = marketPositions && marketPositions.length > 0;
  const hasVaults = vaults && vaults.length > 0;
  const showEmpty = !loading && !isVaultsLoading && !hasSuppliedMarkets && !hasVaults;

  const handleClickHistory = useCallback(() => {
    router.push(`/history/${account}`);
  }, [router, account]);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8">
        <div className="pb-4 flex items-center justify-between">
          <h1 className="font-zen">Portfolio</h1>

          <div className="flex mt-8 gap-2">
            {' '}
            {/* aligned with portfolio  */}
            <Button
              variant="default"
              onClick={() => open('bridgeSwap', {})}
              title="Swap tokens"
            >
              <IoIosSwap className="h-4 w-4" />
              Swap
            </Button>
            <Button
              variant="default"
              onClick={handleClickHistory}
              title="history"
            >
              <GoHistory className="h-4 w-4" />
              History
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pb-4 sm:flex-row">
          <AccountIdentity
            address={account as Address}
            variant="full"
            showAddress
          />
          {!loading && (
            <PortfolioValueBadge
              totalUsd={totalUsd}
              assetBreakdown={assetBreakdown}
              isLoading={isPricesLoading}
              error={pricesError}
            />
          )}
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
          {!loading && hasSuppliedMarkets && <SuppliedMorphoBlueGroupedTable account={account} />}

          {/* Auto Vaults Section (progressive loading) */}
          {isVaultsLoading && !loading && (
            <LoadingScreen
              message="Loading vaults..."
              className="mt-10"
            />
          )}

          {!isVaultsLoading && hasVaults && (
            <UserVaultsTable
              vaults={vaults}
              account={account}
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
