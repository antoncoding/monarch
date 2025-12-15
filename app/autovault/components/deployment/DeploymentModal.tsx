'use client';

import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@heroui/react';
import { FaCube } from 'react-icons/fa';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { useMarkets } from '@/contexts/MarketsContext';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { useUserBalances } from '@/hooks/useUserBalances';
import { getNetworkName, ALL_SUPPORTED_NETWORKS, isAgentAvailable, type SupportedNetworks } from '@/utils/networks';
import { DeploymentProvider, useDeployment } from './DeploymentContext';
import { TokenSelection } from './TokenSelection';

const VAULT_SUPPORTED_NETWORKS: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS.filter((network) => isAgentAvailable(network));

type DeploymentModalContentProps = {
  isOpen: boolean;

  onOpenChange: (open: boolean) => void;
  existingVaults: UserVaultV2[];
};

function DeploymentModalContent({ isOpen, onOpenChange, existingVaults }: DeploymentModalContentProps) {
  const { selectedTokenAndNetwork, createVault, isDeploying } = useDeployment();

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
                  existingVaults={existingVaults}
                />
              </div>

              {selectedTokenAndNetwork && (
                <div className="px-1 text-sm text-secondary">
                  You can configure the vault to have caps, automation agents and more after you deploy the vault.
                </div>
              )}

              {userAlreadyHasVault && selectedTokenAndNetwork && (
                <div className="rounded bg-primary/5 p-3">
                  <Checkbox
                    isSelected={ackExistingVault}
                    onValueChange={setAckExistingVault}
                    className="items-center gap-2"
                    size="sm"
                  >
                    <span className="text-sm leading-5 text-secondary">
                      I understand I already deployed an autovault for this token on {getNetworkName(selectedTokenAndNetwork.networkId)}.
                    </span>
                  </Checkbox>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <ExecuteTransactionButton
                  targetChainId={selectedTokenAndNetwork?.networkId ?? 1}
                  onClick={() => void createVault()}
                  disabled={
                    !selectedTokenAndNetwork ||
                    balancesLoading ||
                    marketsLoading ||
                    (userAlreadyHasVault && !ackExistingVault)
                  }
                  isLoading={isDeploying}
                  variant="primary"
                  className="min-w-[140px]"
                >
                  {isDeploying ? (
                    <div className="flex items-center gap-2">
                      <Spinner />
                      Deploying...
                    </div>
                  ) : balancesLoading || marketsLoading ? (
                    'Loading...'
                  ) : selectedTokenAndNetwork ? (
                    'Deploy Vault'
                  ) : (
                    'Select Asset & Network'
                  )}
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
  existingVaults: UserVaultV2[];
};

export function DeploymentModal({ isOpen, onOpenChange, existingVaults }: DeploymentModalProps) {
  return (
    <DeploymentProvider>
      <DeploymentModalContent
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        existingVaults={existingVaults}
      />
    </DeploymentProvider>
  );
}
