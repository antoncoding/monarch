'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PrimaryButton from '@/components/common/PrimaryButton';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModal } from '@/components/supplyModal';
import { WithdrawModal } from '@/components/withdrawModal';
import useUserPositions from '@/hooks/useUserPositions';

import { MarketPosition } from '@/utils/types';
import { PositionsSummaryTable } from './PositionsSummaryTable';

export default function Positions() {
  const [showSupplyModal, setShowSupplyModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<MarketPosition | null>(null);

  const { account } = useParams<{ account: string }>();

  const { loading, isRefetching, data: marketPositions, refetch } = useUserPositions(account);

  const hasSuppliedMarkets = marketPositions.length > 0;

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <div className="flex items-center justify-between pb-4">
          <h1 className="flex items-center gap-2 py-4 font-zen text-2xl">Portfolio</h1>
          <div className="flex gap-4">
            <Link href={`/history/${account}`}>
              <button
                type="button"
                className="rounded-sm bg-secondary p-2 font-zen text-sm opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
              >
                View History
              </button>
            </Link>
            <Link href={`/rewards/${account}`}>
              <button
                type="button"
                className="rounded-sm bg-secondary p-2 font-zen text-sm opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
              >
                View Rewards
              </button>
            </Link>
          </div>
        </div>

        {showWithdrawModal && selectedPosition && (
          <WithdrawModal
            position={selectedPosition}
            onClose={() => {
              setShowWithdrawModal(false);
              setSelectedPosition(null);
            }}
            refetch={refetch}
          />
        )}

        {showSupplyModal && selectedPosition && (
          <SupplyModal
            market={selectedPosition.market}
            onClose={() => {
              setShowSupplyModal(false);
              setSelectedPosition(null);
            }}
          />
        )}

        {loading ? (
          <LoadingScreen message="Loading Supplies..." />
        ) : !hasSuppliedMarkets ? (
          <EmptyScreen message="No open supplies, go to the markets to open a new position." />
        ) : (
          <div className="mt-4">
            <PositionsSummaryTable
              marketPositions={marketPositions}
              setShowWithdrawModal={setShowWithdrawModal}
              setShowSupplyModal={setShowSupplyModal}
              setSelectedPosition={setSelectedPosition}
              refetch={refetch}
              isRefetching={isRefetching}
            />
          </div>
        )}

        <div className="flex justify-center pt-14">
          <PrimaryButton href="/markets">View All Markets</PrimaryButton>
        </div>
        <div className="flex justify-center pt-8">
          <PrimaryButton href="/positions" isSecondary>
            Search Address
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
