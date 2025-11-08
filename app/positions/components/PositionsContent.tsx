'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FaHistory, FaPlus } from 'react-icons/fa';
import { IoRefreshOutline } from 'react-icons/io5';
import { TbReport } from 'react-icons/tb';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { Button } from '@/components/common/Button';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModalV2 } from '@/components/SupplyModalV2';
import { useMarkets } from '@/hooks/useMarkets';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { MarketPosition } from '@/utils/types';
import { OnboardingModal } from './onboarding/Modal';
import { PositionsSummaryTable } from './PositionsSummaryTable';

export default function Positions() {
  const [showSupplyModal, setShowSupplyModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<MarketPosition | null>(null);

  const { account } = useParams<{ account: string }>();
  const { address } = useAccount();

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
  } = useUserPositionsSummaryData(account);

  const loading = isMarketsLoading || isPositionsLoading;

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
          <AddressDisplay address={account as Address} />
          <div className="flex gap-4">
            <Link href={`/history/${account}`}>
              <Button size="md" className="font-zen text-secondary">
                <FaHistory size={14} className="mr-2" />
                History
              </Button>
            </Link>
            <Link href={`/positions/report/${account}`}>
              <Button size="md" className="font-zen text-secondary">
                <TbReport size={15} className="mr-2" />
                Report
              </Button>
            </Link>
            {isOwner && (
              <Button
                variant="cta"
                size="md"
                className="font-zen"
                onPress={() => setShowOnboardingModal(true)}
              >
                <FaPlus size={14} className="mr-2" />
                New Position
              </Button>
            )}
          </div>
        </div>

        {showWithdrawModal && selectedPosition && (
          <SupplyModalV2
            market={selectedPosition.market}
            position={selectedPosition}
            onClose={() => {
              setShowWithdrawModal(false);
              setSelectedPosition(null);
            }}
            refetch={() => void refetch()}
            isMarketPage={false}
            defaultMode="withdraw"
          />
        )}

        {showSupplyModal && selectedPosition && (
          <SupplyModalV2
            market={selectedPosition.market}
            position={selectedPosition}
            onClose={() => {
              setShowSupplyModal(false);
              setSelectedPosition(null);
            }}
            refetch={() => void refetch()}
            isMarketPage={false}
          />
        )}

        <OnboardingModal
          isOpen={showOnboardingModal}
          onClose={() => setShowOnboardingModal(false)}
        />

        {loading ? (
          <LoadingScreen message="Loading Supplies..." className="mt-10" />
        ) : !hasSuppliedMarkets ? (
          <div className="container flex flex-col">
            <div className="flex w-full justify-end">
              <Button
                variant="light"
                size="sm"
                onPress={handleRefetch}
                className="font-zen text-secondary opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
              >
                <IoRefreshOutline className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <div className="flex justify-center">
              <EmptyScreen message="No open supplies. Start lending now!" className="mt-2" />
            </div>
          </div>
        ) : (
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
