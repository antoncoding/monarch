'use client';

import { useParams } from 'next/navigation';
import type { Address } from 'viem';
import { AccountIdentity } from '@/components/shared/account-identity';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { usePortfolioValue } from '@/hooks/usePortfolioValue';
import { useUserVaultsV2Query } from '@/hooks/queries/useUserVaultsV2Query';
import { SuppliedMorphoBlueGroupedTable } from './components/supplied-morpho-blue-grouped-table';
import { PortfolioValueBadge } from './components/portfolio-value-badge';
import { UserVaultsTable } from './components/user-vaults-table';

export default function Positions() {
  const { account } = useParams<{ account: string }>();

  const { loading: isMarketsLoading } = useProcessedMarkets();

  const { isPositionsLoading, positions: marketPositions } = useUserPositionsSummaryData(account, 'day');

  // Fetch user's auto vaults
  const {
    data: vaults = [],
    isLoading: isVaultsLoading,
    refetch: refetchVaults,
  } = useUserVaultsV2Query({ userAddress: account as Address });

  // Calculate portfolio value from positions and vaults
  const { totalUsd, isLoading: isPricesLoading, error: pricesError } = usePortfolioValue(marketPositions, vaults);

  const loading = isMarketsLoading || isPositionsLoading;

  const loadingMessage = isMarketsLoading ? 'Loading markets...' : 'Loading user positions...';

  const hasSuppliedMarkets = marketPositions && marketPositions.length > 0;
  const hasVaults = vaults && vaults.length > 0;
  const showEmpty = !loading && !isVaultsLoading && !hasSuppliedMarkets && !hasVaults;

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8">
        <div className="pb-4">
          <h1 className="font-zen">Portfolio</h1>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pb-4 sm:flex-row">
          <AccountIdentity
            address={account as Address}
            variant="full"
            showAddress
          />
          {!loading && (hasSuppliedMarkets || hasVaults) && (
            <PortfolioValueBadge
              totalUsd={totalUsd}
              isLoading={isPricesLoading}
              error={pricesError}
              onClick={() => {
                // TODO: Add click handler (show breakdown modal, navigate, etc.)
                console.log('Portfolio value clicked');
              }}
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
            />
          )}

          {/* Empty state (only if both finished loading and both empty) */}
          {showEmpty && (
            <EmptyScreen
              message="No open positions. Start supplying!"
              className="mt-10"
            />
          )}
        </div>
      </div>
    </div>
  );
}
