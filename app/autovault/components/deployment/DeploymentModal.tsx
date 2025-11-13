import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Modal, ModalContent, ModalHeader } from '@heroui/react';
import { RxCross2 } from 'react-icons/rx';
import { Button } from '@/components/common';
import { Spinner } from '@/components/common/Spinner';
import { useMarkets } from '@/contexts/MarketsContext';
import { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { useUserBalances } from '@/hooks/useUserBalances';
import { getNetworkName, ALL_SUPPORTED_NETWORKS, isAgentAvailable, SupportedNetworks } from '@/utils/networks';
import { DeploymentProvider, useDeployment } from './DeploymentContext';
import { TokenSelection } from './TokenSelection';

const VAULT_SUPPORTED_NETWORKS: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS.filter((network) =>
  isAgentAvailable(network),
);

type DeploymentModalContentProps = {
  isOpen: boolean;
  onClose: () => void;
  existingVaults: UserVaultV2[];
};

function DeploymentModalContent({ isOpen, onClose, existingVaults }: DeploymentModalContentProps) {
  const { selectedTokenAndNetwork, needSwitchChain, switchToNetwork, createVault, isDeploying } = useDeployment();

  // Load balances and tokens at modal level
  const { balances, loading: balancesLoading } = useUserBalances({
    networkIds: VAULT_SUPPORTED_NETWORKS,
  });
  const { whitelistedMarkets, loading: marketsLoading } = useMarkets();

  const [ackExistingVault, setAckExistingVault] = useState(false);

  const userAlreadyHasVault = useMemo(() => {
    if (!selectedTokenAndNetwork) return false;

    return existingVaults.some(
      (vault) =>
        vault.networkId === selectedTokenAndNetwork.networkId &&
        vault.asset.toLowerCase() === selectedTokenAndNetwork.token.address.toLowerCase(),
    );
  }, [existingVaults, selectedTokenAndNetwork]);

  useEffect(() => {
    setAckExistingVault(false);
  }, [selectedTokenAndNetwork]);

  useEffect(() => {
    if (!isOpen) {
      setAckExistingVault(false);
    }
  }, [isOpen]);

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
        <ModalHeader className="flex justify-between px-10 pt-6 font-zen">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-normal text-primary">Deploy Autovault</span>
            <span className="text-sm font-normal text-secondary">
              Choose the token and network for your autovault
            </span>
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
                  existingVaults={existingVaults}
                />
              </div>

              {selectedTokenAndNetwork && (
                <div className="text-sm text-secondary font-zen px-1">
                  You can configure the vault to have caps, automation agents and more after you deploy the vault.
                </div>
              )}

              {userAlreadyHasVault && selectedTokenAndNetwork && (
                <div className="rounded bg-primary/5 p-3">
                  <Checkbox
                    isSelected={ackExistingVault}
                    onValueChange={setAckExistingVault}
                    className="gap-2 items-center"
                    size="sm"
                  >
                    <span className="text-sm leading-5 text-secondary">
                      I understand I already deployed an autovault for this token on{' '}
                      {getNetworkName(selectedTokenAndNetwork.networkId)}.
                    </span>
                  </Checkbox>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="cta"
                  onPress={needSwitchChain ? switchToNetwork : () => void createVault()}
                  isDisabled={
                    !selectedTokenAndNetwork ||
                    isDeploying ||
                    balancesLoading ||
                    marketsLoading ||
                    (userAlreadyHasVault && !ackExistingVault)
                  }
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

type DeploymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  existingVaults: UserVaultV2[];
};

export function DeploymentModal({ isOpen, onClose, existingVaults }: DeploymentModalProps) {
  return (
    <DeploymentProvider>
      <DeploymentModalContent isOpen={isOpen} onClose={onClose} existingVaults={existingVaults} />
    </DeploymentProvider>
  );
}
