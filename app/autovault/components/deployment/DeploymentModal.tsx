import { Modal, ModalContent, ModalHeader } from '@heroui/react';
import { RxCross2 } from 'react-icons/rx';
import { Button } from '@/components/common';
import { Spinner } from '@/components/common/Spinner';
import { useMarkets } from '@/contexts/MarketsContext';
import { useUserBalances } from '@/hooks/useUserBalances';
import { getNetworkName } from '@/utils/networks';
import { DeploymentProvider, useDeployment } from './DeploymentContext';
import { DeploymentSuccess } from './DeploymentSuccess';
import { TokenSelection } from './TokenSelection';

function DeploymentModalContent({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { selectedTokenAndNetwork, needSwitchChain, switchToNetwork, createVault, isDeploying, deployedVaultAddress } = useDeployment();

  // Load balances and tokens at modal level
  const { balances, loading: balancesLoading } = useUserBalances();
  const { whitelistedMarkets, loading: marketsLoading } = useMarkets();

  // If deployment is complete, show success
  if (deployedVaultAddress) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: 'bg-background dark:border border-gray-700',
          body: 'py-6',
          closeButton: 'hidden',
          wrapper: 'z-50',
          backdrop: 'z-[45] bg-black/50',
        }}
      >
        <ModalContent className="p-4">
          <ModalHeader className="flex justify-between">
            <div>
              <h2 className="font-zen text-2xl font-normal">Deployment Complete</h2>
              <p className="mt-1 font-zen text-sm font-normal text-secondary">Your autovault has been deployed successfully</p>
            </div>
            <Button isIconOnly onPress={onClose} className="bg-surface">
              <RxCross2 size={16} />
            </Button>
          </ModalHeader>

          <div className="flex-1 overflow-hidden px-8">
            <div className="h-full overflow-y-auto font-zen">
              <DeploymentSuccess onClose={onClose} />
            </div>
          </div>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-background dark:border border-gray-700',
        body: 'py-6',
        closeButton: 'hidden',
        wrapper: 'z-50',
        backdrop: 'z-[45] bg-black/50',
      }}
    >
      <ModalContent className="p-4">
        <ModalHeader className="flex justify-between">
          <div>
            <h2 className="font-zen text-2xl font-normal">Deploy Autovault</h2>
            <p className="mt-1 font-zen text-sm font-normal text-secondary">Choose the token and network for your autovault</p>
          </div>
          <Button isIconOnly onPress={onClose} className="bg-surface">
            <RxCross2 size={16} />
          </Button>
        </ModalHeader>

        <div className="flex-1 overflow-hidden px-8">
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
                <div className="text-sm text-secondary font-zen px-1">
                  You can configure the vault to have caps, automation agents and more after you deploy the vault.
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="cta"
                  onPress={needSwitchChain ? switchToNetwork : () => void createVault()}
                  isDisabled={!selectedTokenAndNetwork || isDeploying || balancesLoading || marketsLoading}
                  className="min-w-[140px]"
                >
                  {isDeploying ? (
                    <div className="flex items-center gap-2">
                      <Spinner />
                      Deploying...
                    </div>
                  ) : balancesLoading || marketsLoading ? (
                    'Loading...'
                  ) : needSwitchChain && selectedTokenAndNetwork ? (
                    `Switch to ${getNetworkName(selectedTokenAndNetwork.networkId)}`
                  ) : selectedTokenAndNetwork ? (
                    'Deploy Vault'
                  ) : (
                    'Select Asset & Network'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

export function DeploymentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <DeploymentProvider>
      <DeploymentModalContent isOpen={isOpen} onClose={onClose} />
    </DeploymentProvider>
  );
}