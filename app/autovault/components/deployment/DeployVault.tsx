import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { useDeployment } from './DeploymentContext';

export function DeployVault() {
  const {
    selectedTokenAndNetwork,
    needSwitchChain,
    switchToNetwork,
    createVault,
    isDeploying,
  } = useDeployment();

  if (!selectedTokenAndNetwork) {
    return (
      <div className="text-center">
        <p className="text-secondary">Missing token or network selection</p>
      </div>
    );
  }

  const { token: selectedToken, networkId: selectedNetwork } = selectedTokenAndNetwork;
  const networkImg = getNetworkImg(selectedNetwork);
  const networkName = getNetworkName(selectedNetwork);

  return (
    <div className="space-y-6">
      {/* Network Switch Notice */}
      {needSwitchChain && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Switch Network</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                You need to switch to {networkName} to deploy this vault
              </p>
            </div>
            <Button variant="cta" onPress={switchToNetwork}>
              Switch to {networkName}
            </Button>
          </div>
        </div>
      )}

      {/* Configuration Summary Card */}
      <div className="bg-surface rounded border border-divider p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-secondary">Base Asset</span>
            <div className="flex items-center gap-2">
              <TokenIcon address={selectedToken.address} chainId={selectedNetwork} width={20} height={20} />
              <span className="font-medium">{selectedToken.symbol}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary">Network</span>
            <div className="flex items-center gap-2">
              <Image
                src={networkImg!}
                alt={networkName ?? ''}
                width={20}
                height={20}
                className="rounded-full"
              />
              <span className="font-medium">{networkName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Status */}
      {isDeploying && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800 p-4 text-center">
          <div className="mx-auto mb-3 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <Spinner />
          </div>
          <p className="text-sm text-secondary">
            Deploying vault contract...
          </p>
        </div>
      )}

      <div className="flex justify-between gap-3 pt-4">
        <Button
          variant="cta"
          onPress={() => void createVault()}
          isDisabled={isDeploying || needSwitchChain}
          className="min-w-[140px]"
        >
          {isDeploying ? (
            <div className="flex items-center gap-2">
              <Spinner />
              Deploying...
            </div>
          ) : needSwitchChain ? (
            'Switch Network First'
          ) : (
            'Deploy Vault'
          )}
        </Button>
      </div>
    </div>
  );
}
