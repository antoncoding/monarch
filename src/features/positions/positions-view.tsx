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
import { SupplyModalV2 } from '@/modals/supply/supply-modal';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useMarkets } from '@/hooks/useMarkets';
import useUserPositionsSummaryData, { type EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import { usePortfolioValue } from '@/hooks/usePortfolioValue';
import type { MarketPosition } from '@/utils/types';
import { SuppliedMorphoBlueGroupedTable } from './components/supplied-morpho-blue-grouped-table';
import { PortfolioValueBadge } from './components/portfolio-value-badge';

export default function Positions() {
  const [showSupplyModal, setShowSupplyModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<MarketPosition | null>(null);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('day');

  const { account } = useParams<{ account: string }>();

  const { loading: isMarketsLoading } = useMarkets();

  const {
    isPositionsLoading,
    isEarningsLoading,
    isRefetching,
    positions: marketPositions,
    refetch,
    loadingStates,
  } = useUserPositionsSummaryData(account, earningsPeriod);

  // Calculate portfolio value from positions
  const { totalUsd, isLoading: isPricesLoading, error: pricesError } = usePortfolioValue(marketPositions);

  const loading = isMarketsLoading || isPositionsLoading;

  // Generate loading message based on current state
  const loadingMessage = useMemo(() => {
    if (isMarketsLoading) return 'Loading markets...';
    if (loadingStates.positions) return 'Loading user positions...';
    if (loadingStates.blocks) return 'Fetching block numbers...';
    if (loadingStates.snapshots) return 'Loading historical snapshots...';
    if (loadingStates.transactions) return 'Loading transaction history...';
    return 'Loading...';
  }, [isMarketsLoading, loadingStates]);

  const hasSuppliedMarkets = marketPositions && marketPositions.length > 0;

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
          {!loading && hasSuppliedMarkets && (
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

        {showWithdrawModal && selectedPosition && (
          <SupplyModalV2
            market={selectedPosition.market}
            position={selectedPosition}
            onOpenChange={setShowWithdrawModal}
            refetch={() => void refetch()}
            isMarketPage={false}
            defaultMode="withdraw"
          />
        )}

        {showSupplyModal && selectedPosition && (
          <SupplyModalV2
            market={selectedPosition.market}
            position={selectedPosition}
            onOpenChange={setShowSupplyModal}
            refetch={() => void refetch()}
            isMarketPage={false}
          />
        )}

        {loading ? (
          <LoadingScreen
            message={loadingMessage}
            className="mt-10"
          />
        ) : hasSuppliedMarkets ? (
          <div className="mt-4">
            <SuppliedMorphoBlueGroupedTable
              account={account}
              marketPositions={marketPositions}
              setShowWithdrawModal={setShowWithdrawModal}
              setShowSupplyModal={setShowSupplyModal}
              setSelectedPosition={setSelectedPosition}
              refetch={() => void refetch()}
              isRefetching={isRefetching}
              isLoadingEarnings={isEarningsLoading}
              earningsPeriod={earningsPeriod}
              setEarningsPeriod={setEarningsPeriod}
            />
          </div>
        ) : (
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
                message="No open supplies. Start lending now!"
                className="mt-2"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
