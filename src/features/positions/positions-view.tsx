'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tooltip } from '@/components/ui/tooltip';
import { IoRefreshOutline } from 'react-icons/io5';
import { toast } from 'react-toastify';
import type { Address } from 'viem';
import { AccountIdentity } from '@/components/shared/account-identity';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import useUserPositionsSummaryData, { type EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import { usePortfolioValue } from '@/hooks/usePortfolioValue';
import { useUserVaultsV2Query } from '@/hooks/queries/useUserVaultsV2Query';
import { SuppliedMorphoBlueGroupedTable } from './components/supplied-morpho-blue-grouped-table';
import { PortfolioValueBadge } from './components/portfolio-value-badge';
import { UserVaultsTable } from './components/user-vaults-table';

export default function Positions() {
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('day');

  const { account } = useParams<{ account: string }>();

  const { loading: isMarketsLoading } = useProcessedMarkets();

  const {
    isPositionsLoading,
    isEarningsLoading,
    isRefetching,
    positions: marketPositions,
    refetch,
    loadingStates,
    isTruncated,
    actualBlockData,
  } = useUserPositionsSummaryData(account, earningsPeriod);

  // Fetch user's auto vaults
  const {
    data: vaults = [],
    isLoading: isVaultsLoading,
    refetch: refetchVaults,
  } = useUserVaultsV2Query({ userAddress: account as Address });

  // Calculate portfolio value from positions and vaults
  const { totalUsd, isLoading: isPricesLoading, error: pricesError } = usePortfolioValue(marketPositions, vaults);

  const loading = isMarketsLoading || isPositionsLoading;

  // Generate loading message based on current state
  const loadingMessage = useMemo(() => {
    if (isMarketsLoading) return 'Loading markets...';
    if (loadingStates.positions) return 'Loading user positions...';
    if (loadingStates.snapshots) return 'Loading historical snapshots...';
    if (loadingStates.transactions) return 'Loading transaction history...';
    return 'Loading...';
  }, [isMarketsLoading, loadingStates]);

  const hasSuppliedMarkets = marketPositions && marketPositions.length > 0;
  const hasVaults = vaults && vaults.length > 0;
  const showEmpty = !loading && !isVaultsLoading && !hasSuppliedMarkets && !hasVaults;

  const handleRefetch = () => {
    void refetch(() => toast.info('Data refreshed', { icon: <span>🚀</span> }));
  };

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[4%]">
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
          {!loading && hasSuppliedMarkets && (
            <>
              {/* Data Truncation Warning */}
              {isTruncated && (
                <div className="mb-4 rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-warning text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-warning">Transaction history exceeds 1,000 entries</p>
                      <p className="mt-1 text-xs text-secondary">
                        Earnings calculations may be incomplete.{' '}
                        <a
                          href={`/positions-report/${account}`}
                          className="text-primary underline hover:text-primary/80"
                        >
                          Use Position Report
                        </a>{' '}
                        for complete and accurate data.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <SuppliedMorphoBlueGroupedTable
                account={account}
                marketPositions={marketPositions}
                refetch={() => void refetch()}
                isRefetching={isRefetching}
                isLoadingEarnings={isEarningsLoading}
                earningsPeriod={earningsPeriod}
                setEarningsPeriod={setEarningsPeriod}
                chainBlockData={actualBlockData}
              />
            </>
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
              vaults={vaults}
              account={account}
              refetch={() => void refetchVaults()}
            />
          )}

          {/* Empty state (only if both finished loading and both empty) */}
          {showEmpty && (
            <div className="container flex flex-col">
              <div className="flex w-full justify-end">
                <Tooltip
                  content={
                    <TooltipContent
                      title="Refresh"
                      detail="Fetch latest data"
                    />
                  }
                >
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefetch}
                      className="text-secondary min-w-0 px-2"
                    >
                      <IoRefreshOutline className="h-3 w-3" />
                    </Button>
                  </span>
                </Tooltip>
              </div>
              <div className="flex justify-center">
                <EmptyScreen
                  message="No open positions. Start supplying!"
                  className="mt-2"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
