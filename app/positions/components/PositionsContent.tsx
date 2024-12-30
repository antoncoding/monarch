'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FaHistory, FaPlus, FaCircle } from 'react-icons/fa';
import { IoRefreshOutline } from 'react-icons/io5';
import { RiRobot2Line } from 'react-icons/ri';
import { TbReport } from 'react-icons/tb';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Name } from '@/components/common/Name';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModal } from '@/components/supplyModal';
import { WithdrawModal } from '@/components/withdrawModal';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { useUserRebalancerInfo } from '@/hooks/useUserRebalancerInfo';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition } from '@/utils/types';
import { SetupAgentModal } from './agent/SetupAgentModal';
import { OnboardingModal } from './onboarding/Modal';
import { PositionsSummaryTable } from './PositionsSummaryTable';

export default function Positions() {
  const [showSupplyModal, setShowSupplyModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [showSetupAgentModal, setShowSetupAgentModal] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<MarketPosition | null>(null);

  const { account } = useParams<{ account: string }>();
  const { address, isConnected } = useAccount();
  const { rebalancerInfo, refetch: refetchRebalancerInfo } = useUserRebalancerInfo(address);

  const isOwner = useMemo(() => {
    if (!account) return false;
    return account === address;
  }, [account, address]);

  const {
    isLoading,
    isRefetching,
    positions: marketPositions,
    refetch,
  } = useUserPositionsSummaryData(account);

  const hasSuppliedMarkets = marketPositions && marketPositions.length > 0;

  const hasActivePositionOnBase = marketPositions?.some((position) => {
    return (
      position.market.morphoBlue.chain.id === SupportedNetworks.Base &&
      BigInt(position.supplyShares) > 0
    );
  });

  const handleRefetch = () => {
    refetch(() => toast.info('Data refreshed', { icon: <span>🚀</span> }));
  };

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[5%]">
        <div className="pb-4">
          <h1 className="font-zen">Portfolio</h1>
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
            {isOwner && hasActivePositionOnBase && (
              <Button size="md" className="font-zen" onClick={() => setShowSetupAgentModal(true)}>
                <RiRobot2Line size={14} className="mr-2" />
                Monarch Agent <Badge variant="success">New</Badge>
              </Button>
            )}
            {isOwner && (
              <Button
                variant="cta"
                size="md"
                className="font-zen"
                onClick={() => setShowOnboardingModal(true)}
              >
                <FaPlus size={14} className="mr-2" />
                New Position
              </Button>
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

        <OnboardingModal
          isOpen={showOnboardingModal}
          onClose={() => setShowOnboardingModal(false)}
          goToAgentSetup={() => {
            setShowSetupAgentModal(true);
          }}
        />

        <SetupAgentModal
          isOpen={showSetupAgentModal}
          onClose={() => {
            void refetchRebalancerInfo();
            setShowSetupAgentModal(false);
          }}
          account={account as Address}
          userRebalancerInfo={rebalancerInfo}
        />

        {isLoading ? (
          <LoadingScreen message="Loading Supplies..." className="mt-10" />
        ) : !hasSuppliedMarkets ? (
          <div className="container flex flex-col">
            <div className="flex w-full justify-end">
              <Button
                variant="light"
                size="sm"
                onClick={handleRefetch}
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
              refetch={refetch}
              isRefetching={isRefetching}
              rebalancerInfo={rebalancerInfo}
            />
          </div>
        )}
      </div>
    </div>
  );
}
