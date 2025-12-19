'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Tooltip } from '@heroui/react';
import { FaHistory, FaPlus } from 'react-icons/fa';
import { IoRefreshOutline } from 'react-icons/io5';
import { TbReport } from 'react-icons/tb';
import { toast } from 'react-toastify';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { AccountIdentity } from '@/components/shared/account-identity';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModalV2 } from '@/modals/supply/supply-modal';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useMarkets } from '@/hooks/useMarkets';
import useUserPositionsSummaryData, { type EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import type { MarketPosition } from '@/utils/types';
import { OnboardingModal } from './components/onboarding/onboarding-modal';
import { PositionsSummaryTable } from '../positions-summary-table';

export default function Positions() {
  const [showSupplyModal, setShowSupplyModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<MarketPosition | null>(null);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('day');

  const { account } = useParams<{ account: string }>();
  const { address } = useConnection();

  const [mounted, setMounted] = useState(false);

  const isOwner = useMemo(() => {
    if (!account || !address || !mounted) return false;
    return account === address;
  }, [account, address, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { loading: isMarketsLoading } = useMarkets();

  const {
    isPositionsLoading,
    isEarningsLoading,
    isRefetching,
    positions: marketPositions,
    refetch,
    loadingStates,
  } = useUserPositionsSummaryData(account, earningsPeriod);

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
        <div className="flex flex-col items-center justify-between pb-4 sm:flex-row">
          <AccountIdentity
            address={account as Address}
            variant="full"
            showAddress
          />
          <div className="flex gap-4">
            <Link href={`/history/${account}`}>
              <Button
                size="md"
                className="font-zen text-secondary"
              >
                <FaHistory
                  size={14}
                  className="mr-2"
                />
                History
              </Button>
            </Link>
            <Link href={`/positions/report/${account}`}>
              <Button
                size="md"
                className="font-zen text-secondary"
              >
                <TbReport
                  size={15}
                  className="mr-2"
                />
                Report
              </Button>
            </Link>
            {isOwner && (
              <Button
                variant="primary"
                size="md"
                className="font-zen"
                onClick={() => setShowOnboardingModal(true)}
              >
                <FaPlus
                  size={14}
                  className="mr-2"
                />
                New Position
              </Button>
            )}
          </div>
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

        <OnboardingModal
          isOpen={showOnboardingModal}
          onOpenChange={setShowOnboardingModal}
        />

        {loading ? (
          <LoadingScreen
            message={loadingMessage}
            className="mt-10"
          />
        ) : hasSuppliedMarkets ? (
          <div className="mt-4">
            <PositionsSummaryTable
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
                classNames={{
                  base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                  content: 'p-0 m-0 bg-transparent shadow-sm border-none',
                }}
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
