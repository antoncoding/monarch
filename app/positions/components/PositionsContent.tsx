'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useUserRewards from '@/hooks/useRewards';
import useUserPositions from '@/hooks/useUserPositions';

import { MarketPosition } from '@/utils/types';
import { SuppliedMarketsTable } from './SuppliedMarketsTable';
import { WithdrawModal } from './withdrawModal';

export default function Positions() {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<MarketPosition | null>(null);

  const { account } = useParams<{ account: string }>();

  const { loading, data: marketPositions } = useUserPositions(account);
  const { rewards, loading: loadingRewards } = useUserRewards(account);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <Toaster />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <div className="flex items-center justify-between">
          <h1 className="py-4 font-zen text-2xl"> User Portfolio </h1>
          <Link href={`/rewards/${account}`}>
            <button
              type="button"
              className="rounded-sm bg-secondary p-2 font-zen text-sm opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
            >
              View All Rewards
            </button>
          </Link>
        </div>

        {showModal && selectedPosition && (
          <WithdrawModal
            position={selectedPosition}
            onClose={() => {
              setShowModal(false);
              setSelectedPosition(null);
            }}
          />
        )}

        {loading || loadingRewards ? (
          <div className="py-3 opacity-70"> Loading Positions... </div>
        ) : marketPositions.length === 0 ? (
          <div className="w-full items-center rounded-md p-12 text-center text-secondary">
            No opened positions, goes to the{' '}
            <a href="/markets" className="text-orange-500 no-underline">
              {' '}
              Markets{' '}
            </a>{' '}
            to open a new position.
          </div>
        ) : (
          <div className="mt-4">
            <h1 className="py-4 font-zen text-xl"> Supplied Markets </h1>

            <SuppliedMarketsTable
              marketPositions={marketPositions}
              rewards={rewards}
              setShowModal={setShowModal}
              setSelectedPosition={setSelectedPosition}
            />
          </div>
        )}

        <div className="flex justify-center pt-14">
          <Link href="/markets">
            <button
              type="button"
              className="bg-monarch-orange rounded-sm p-3 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
            >
              View All Markets
            </button>
          </Link>
        </div>
        <div className="flex justify-center pt-8">
          <Link href="/positions">
            <button
              type="button"
              className="rounded-sm bg-secondary p-3 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
            >
              Search Address
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
