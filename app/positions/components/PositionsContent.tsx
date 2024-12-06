'use client';

import { useMemo, useState } from 'react';
import { Name } from '@coinbase/onchainkit/identity';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FaHistory, FaGift, FaPlus, FaCircle } from 'react-icons/fa';
import { useAccount } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
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
  const { address, isConnected } = useAccount();

  const isOwner = useMemo(() => {
    if (!account) return false;
    return account === address;
  }, [account, address]);

  const { loading, isRefetching, data: marketPositions, refetch } = useUserPositions(account);

  const hasSuppliedMarkets = marketPositions && marketPositions.length > 0;

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <div className="mb-4 flex items-center">
          <h1 className="font-zen text-2xl">Portfolio</h1>
        </div>
        <div className="flex flex-col items-center justify-between pb-4 sm:flex-row">
          <div className="flex items-start gap-4">
            <div className="relative overflow-hidden rounded">
              <Avatar address={account as `0x${string}`} size={36} rounded={false} />
              {isConnected && account === address && (
                <div className="absolute bottom-0 right-0 h-4 w-full bg-gradient-to-r from-green-500/20 to-green-500/40 backdrop-blur-sm">
                  <div className="absolute bottom-1 right-1">
                    <FaCircle size={8} className="text-green-500" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <Name
                address={account as `0x${string}`}
                className={`rounded p-2 font-monospace text-sm ${
                  isConnected && account === address
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-hovered'
                }`}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <Link href={`/history/${account}`} className="no-underline">
              <button
                type="button"
                aria-label="View history"
                className="bg-surface flex items-center gap-2 rounded p-2 font-zen text-sm text-secondary opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
              >
                <FaHistory size={14} />
                History
              </button>
            </Link>
            <Link href={`/rewards/${account}`} className="no-underline">
              <button
                type="button"
                aria-label="View rewards"
                className="bg-surface flex items-center gap-2 rounded p-2 font-zen text-sm text-secondary opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
              >
                <FaGift size={14} />
                Rewards
              </button>
            </Link>
            {isOwner && (
              <Link href="/positions/onboarding" className="no-underline">
                <button
                  aria-label="Create a new position"
                  type="button"
                  className="bg-monarch-orange hover:bg-monarch-orange/90 flex items-center gap-2 rounded p-2 font-zen text-sm text-white shadow-sm transition-all duration-200 ease-in-out hover:shadow-md"
                  disabled={account !== address}
                >
                  <FaPlus size={14} />
                  New Position
                </button>
              </Link>
            )}
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
          <div className="flex flex-col items-center gap-8">
            <EmptyScreen message="No open supplies. Start lending now!" />
            <Link href="/positions/onboarding" passHref>
              <button
                type="button"
                className="bg-monarch-orange mx-auto rounded px-8 py-3 font-zen text-white opacity-90 transition-all duration-200 ease-in-out hover:opacity-100"
              >
                Start Lending
              </button>
            </Link>
          </div>
        ) : (
          <div className="mt-4">
            <PositionsSummaryTable
              account={account}
              marketPositions={marketPositions}
              setShowWithdrawModal={setShowWithdrawModal}
              setShowSupplyModal={setShowSupplyModal}
              setSelectedPosition={setSelectedPosition}
              refetch={refetch}
              isRefetching={isRefetching}
            />
          </div>
        )}
      </div>
    </div>
  );
}
