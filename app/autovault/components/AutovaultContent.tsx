'use client';

import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import AccountConnect from '@/components/layout/header/AccountConnect';
import Header from '@/components/layout/header/Header';
import { useUserVaultsV2 } from '@/hooks/useUserVaultsV2';
import { DeploymentModal } from './deployment/DeploymentModal';
import { VaultListV2 } from './VaultListV2';

export default function AutovaultContent() {
  const { isConnected } = useConnection();
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
              variant={hasExistingVaults ? 'secondary' : 'cta'}
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
          <VaultListV2
            vaults={vaults}
            loading={vaultsLoading}
          />
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
