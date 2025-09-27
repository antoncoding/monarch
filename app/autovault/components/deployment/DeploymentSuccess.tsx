import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { FaCopy } from 'react-icons/fa';
import { FiExternalLink } from 'react-icons/fi';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { Button } from '@/components/common/Button';
import { TokenIcon } from '@/components/TokenIcon';
import { getExplorerURL } from '@/utils/external';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { useDeployment } from './DeploymentContext';

export function DeploymentSuccess({ onClose }: { onClose: () => void }) {
  const { selectedTokenAndNetwork, deployedVaultAddress, resetDeployment } = useDeployment();

  if (!selectedTokenAndNetwork || !deployedVaultAddress) {
    return (
      <div className="text-center">
        <p className="text-secondary">Deployment information not available</p>
      </div>
    );
  }

  const { token: selectedToken, networkId: selectedNetwork } = selectedTokenAndNetwork;
  const networkImg = getNetworkImg(selectedNetwork);
  const networkName = getNetworkName(selectedNetwork);
  const explorerUrl = getExplorerURL(selectedNetwork.toString(), deployedVaultAddress);

  const handleFinish = () => {
    onClose();
    resetDeployment();
  };

  const handleManageVault = () => {
    onClose();
    resetDeployment();
    // Navigate to vault management page
    window.location.href = `/autovault/${deployedVaultAddress}`;
  };

  const copyAddress = () => {
    void navigator.clipboard.writeText(deployedVaultAddress);
    // TODO: Add toast notification
    console.log('Address copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">Vault Deployed Successfully!</h3>
        <p className="text-sm text-secondary">
          Your autovault contract is now live and ready to use
        </p>
      </div>

      {/* Vault Information */}
      <div className="bg-surface rounded-lg border border-divider p-4">
        <h4 className="mb-3 font-medium">Vault Details</h4>
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
                alt={networkName}
                width={20}
                height={20}
                className="rounded-full"
              />
              <span className="font-medium">{networkName}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary">Contract Address</span>
            <div className="flex items-center gap-2">
              <AddressDisplay address={deployedVaultAddress} />
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={copyAddress}
                className="h-6 w-6"
              >
                <FaCopy className="h-3 w-3" />
              </Button>
              <Link href={explorerUrl} target="_blank" rel="noopener noreferrer">
                <Button isIconOnly variant="light" size="sm" className="h-6 w-6">
                  <FiExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-surface rounded-lg border border-divider p-4">
        <h4 className="mb-2 font-medium">Next Steps</h4>
        <ul className="space-y-1 text-sm text-secondary">
          <li>• Configure automation strategies and agents</li>
          <li>• Set up rebalancing rules and risk parameters</li>
          <li>• Deposit funds to start automated management</li>
          <li>• Monitor performance and adjust settings as needed</li>
        </ul>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="light" onPress={handleFinish}>
          Close
        </Button>
        <Button variant="cta" onPress={handleManageVault}>
          Manage Vault
        </Button>
      </div>
    </div>
  );
}
