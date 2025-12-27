'use client';

import { useCallback } from 'react';
import { FaCube, FaCheck } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useUserBalances } from '@/hooks/useUserBalances';
import { ALL_SUPPORTED_NETWORKS, isAgentAvailable, SupportedNetworks } from '@/utils/networks';
import { DeploymentProvider, useDeployment } from '@/features/autovault/components/deployment/deployment-context';
import { TokenSelection } from './token-selection';

const VAULT_SUPPORTED_NETWORKS: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS.filter((network) => isAgentAvailable(network));

type DeploymentModalContentProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

function DeploymentModalContent({ isOpen, onOpenChange }: DeploymentModalContentProps) {
  const { selectedTokenAndNetwork, createVault, isDeploying, deploymentPhase, deployedVaultAddress, navigateToVault } = useDeployment();

  // Load balances and tokens at modal level
  const { balances, loading: balancesLoading } = useUserBalances({
    networkIds: VAULT_SUPPORTED_NETWORKS,
  });
  const { whitelistedMarkets, loading: marketsLoading } = useProcessedMarkets();

  const handleCreateVault = useCallback(() => {
    void createVault();
  }, [createVault]);

  const getButtonText = useCallback(() => {
    if (isDeploying) return 'Deploying...';
    if (balancesLoading || marketsLoading) return 'Loading...';
    if (!selectedTokenAndNetwork) return 'Select Asset & Network';
    return 'Deploy Vault';
  }, [isDeploying, balancesLoading, marketsLoading, selectedTokenAndNetwork]);

  // Success phase: show success state with navigation
  if (deploymentPhase === 'success') {
    return (
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="2xl"
        scrollBehavior="inside"
        backdrop="blur"
        className="bg-background dark:border border-gray-700"
      >
        <ModalHeader
          title="Vault Deployed!"
          description=""
          mainIcon={<FaCube className="h-5 w-5" />}
          onClose={() => onOpenChange(false)}
        />
        <ModalBody className="px-8">
          <div className="flex flex-col items-center justify-center space-y-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <FaCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-primary">Your vault is ready!</h3>
            <p className="max-w-md text-center text-sm text-secondary">
              {deployedVaultAddress
                ? 'Complete the initialization to start using your autovault.'
                : 'Your vault was successfully deployed.'}
            </p>
            {deployedVaultAddress ? (
              <Button
                variant="primary"
                size="lg"
                onClick={navigateToVault}
                className="font-zen px-8"
              >
                Start Setup
              </Button>
            ) : (
              <Button
                variant="default"
                size="lg"
                onClick={() => onOpenChange(false)}
                className="font-zen px-8"
              >
                Close
              </Button>
            )}
          </div>
        </ModalBody>
      </Modal>
    );
  }

  // Selection/Deploying phase: show token selection
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
      className="bg-background dark:border border-gray-700"
    >
      <ModalHeader
        title="Deploy Autovault"
        description="Choose the token and network for your autovault"
        mainIcon={<FaCube className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />

      <ModalBody className="px-8">
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto font-zen">
            <div className="space-y-8">
              <div className="pt-2">
                <TokenSelection
                  balances={balances}
                  balancesLoading={balancesLoading}
                  whitelistedMarkets={whitelistedMarkets}
                  marketsLoading={marketsLoading}
                />
              </div>

              {selectedTokenAndNetwork && (
                <div className="px-1 text-sm text-secondary">
                  You can configure the vault to have caps, automation agents and more after you deploy the vault.
                </div>
              )}

              <div className="flex justify-end pt-2">
                <ExecuteTransactionButton
                  targetChainId={selectedTokenAndNetwork?.networkId ?? SupportedNetworks.Base}
                  onClick={handleCreateVault}
                  disabled={!selectedTokenAndNetwork || balancesLoading || marketsLoading}
                  isLoading={isDeploying}
                  variant="primary"
                  className="min-w-[140px]"
                >
                  {getButtonText()}
                </ExecuteTransactionButton>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

type DeploymentModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeploymentModal({ isOpen, onOpenChange }: DeploymentModalProps) {
  return (
    <DeploymentProvider>
      <DeploymentModalContent
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      />
    </DeploymentProvider>
  );
}
