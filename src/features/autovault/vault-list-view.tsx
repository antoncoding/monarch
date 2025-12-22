'use client';

import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import AccountConnect from '@/components/layout/header/AccountConnect';
import Header from '@/components/layout/header/Header';
import { useUserVaultsV2 } from '@/hooks/useUserVaultsV2';
import { UserVaultsTable } from '@/features/positions/components/user-vaults-table';
import { DeploymentModal } from './components/deployment/deployment-modal';

export default function AutovaultListContent() {
  const { isConnected, address } = useConnection();
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);

  const { vaults, loading: vaultsLoading } = useUserVaultsV2();
  const hasExistingVaults = vaults.length > 0;

  const handleCreateVault = () => {
    setShowDeploymentModal(true);
  };

  if (!isConnected) {
    return (
      <div className="flex w-full flex-col justify-between font-zen">
        <Header />
        <div className="container h-full gap-8 px-[4%]">
          <div className="pb-4">
            <h1 className="font-zen">Autovault</h1>
          </div>
          <div className="flex flex-col items-center justify-between pb-4 sm:flex-row">
            <div className="flex flex-col">
              <p className="text-sm text-secondary">Automate your vault management with intelligent agents</p>
            </div>
          </div>

          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <p className="mb-6 text-lg text-secondary">Connect your wallet to view and manage your autovaults</p>
              <AccountConnect />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[4%]">
        <div className="pb-4">
          <h1 className="font-zen">Autovault</h1>
        </div>

        <div className="flex flex-col items-center justify-between pb-4 sm:flex-row">
          <div className="flex flex-col">
            <p className="text-sm text-secondary">Automate your vault management with intelligent agents</p>
          </div>
          <div className="flex gap-4">
            <Button
              variant={hasExistingVaults ? 'surface' : 'primary'}
              size="md"
              className="font-zen"
              onClick={handleCreateVault}
            >
              <FaPlus
                size={14}
                className="mr-2"
              />
              Create Autovault
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {vaultsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Spinner />
                <p className="mt-3 text-sm text-secondary">Loading your vaults...</p>
              </div>
            </div>
          ) : vaults.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <span className="text-2xl">🏛️</span>
              </div>
              <h3 className="text-lg mb-2">No Vaults Found</h3>
              <p className="text-secondary max-w-sm mx-auto">
                You haven't deployed any autovaults yet. Create your first one to get started!
              </p>
            </div>
          ) : (
            <UserVaultsTable
              vaults={vaults}
              account={address ?? '0x'}
            />
          )}
        </div>

        {/* Deployment Modal */}
        <DeploymentModal
          isOpen={showDeploymentModal}
          onOpenChange={setShowDeploymentModal}
          existingVaults={vaults}
        />
      </div>
    </div>
  );
}
