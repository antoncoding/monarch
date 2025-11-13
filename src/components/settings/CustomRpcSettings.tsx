'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { useStyledToast } from '@/hooks/useStyledToast';
import { SupportedNetworks, networks } from '@/utils/networks';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { useCustomRpcContext } from '../providers/CustomRpcProvider';

// Helper function to get expected chain ID for each network
const getExpectedChainId = (network: SupportedNetworks): number => {
  return network;
};

// Helper function to validate RPC URL and check chain ID
async function validateRpcUrl(
  url: string,
  expectedChainId: number,
): Promise<{ isValid: boolean; error?: string }> {
  if (!url.trim()) {
    return { isValid: true }; // Empty URL is valid (will use default)
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }

  // Test the RPC endpoint
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      }),
    });

    if (!response.ok) {
      return { isValid: false, error: `RPC server responded with ${response.status}` };
    }

    const data = (await response.json()) as { error?: { message: string }; result?: string };
    if (data.error) {
      return { isValid: false, error: `RPC error: ${data.error.message}` };
    }

    const chainId = parseInt(data.result || '0x0', 16);
    if (chainId !== expectedChainId) {
      const networkName = networks.find((n) => n.network === expectedChainId)?.name;
      return {
        isValid: false,
        error: `Chain ID mismatch: expected ${expectedChainId} (${networkName}) but got ${chainId}`,
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to connect to RPC: ${
        error instanceof Error ? error.message : 'Network error'
      }`,
    };
  }
}

function RpcModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { customRpcUrls, setRpcUrl, resetRpcUrl, resetAllRpcUrls, isUsingCustomRpc } =
    useCustomRpcContext();
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const { success, error: toastError } = useStyledToast();

  const handleNetworkSelect = (chainId: SupportedNetworks) => {
    const currentRpcUrl = customRpcUrls[chainId] || '';
    setSelectedNetwork(chainId);
    setInputValue(currentRpcUrl);
    setError('');
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setError('');
  };

  const handleSave = async () => {
    if (!selectedNetwork) return;

    const url = inputValue.trim();
    setIsValidating(true);
    setError('');

    try {
      const expectedChainId = getExpectedChainId(selectedNetwork);
      const validation = await validateRpcUrl(url, expectedChainId);

      if (!validation.isValid) {
        setError(validation.error || 'Invalid RPC URL');
        setIsValidating(false);
        return;
      }

      setRpcUrl(selectedNetwork, url || undefined);
      const networkName = networks.find((n) => n.network === selectedNetwork)?.name;

      if (url) {
        success(
          'RPC Updated',
          `Custom RPC configured for ${networkName}. Please refresh the page to apply changes.`,
        );
      } else {
        success(
          'RPC Reset',
          `${networkName} now uses default Alchemy RPC. Please refresh the page to apply changes.`,
        );
      }

      setError('');
      setInputValue('');
      setSelectedNetwork(null);
    } catch (validationError) {
      toastError('Validation Failed', 'Unable to validate RPC endpoint');
      setError('Failed to validate RPC endpoint');
    } finally {
      setIsValidating(false);
    }
  };

  const handleReset = () => {
    if (!selectedNetwork) return;

    const networkName = networks.find((n) => n.network === selectedNetwork)?.name;
    resetRpcUrl(selectedNetwork);
    success(
      'RPC Reset',
      `${networkName} reset to default Alchemy RPC. Please refresh the page to apply changes.`,
    );

    setInputValue('');
    setError('');
    setSelectedNetwork(null);
  };

  const handleClose = () => {
    setSelectedNetwork(null);
    setInputValue('');
    setError('');
    onClose();
  };

  const handleResetAll = () => {
    const customCount = Object.keys(customRpcUrls).length;
    resetAllRpcUrls();
    success(
      'All RPCs Reset',
      `${customCount} custom RPC${
        customCount !== 1 ? 's' : ''
      } reset to default. Please refresh the page to apply changes.`,
    );

    setSelectedNetwork(null);
    setInputValue('');
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="2xl" scrollBehavior="inside">
      <ModalHeader
        title="Configure RPC Endpoints"
        description="Set custom RPC URLs to override the default Alchemy connections"
        onClose={handleClose}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onPress={handleResetAll}
            isDisabled={Object.keys(customRpcUrls).length === 0}
          >
            Reset All
          </Button>
        }
      />
      <ModalBody className="gap-6">
        <div className="flex flex-col gap-2">
          {networks.map((network) => {
            const chainId = network.network;
            const isCustom = isUsingCustomRpc(chainId);
            const isSelected = selectedNetwork === chainId;

            return (
              <button
                  key={chainId}
                  type="button"
                  onClick={() => handleNetworkSelect(chainId)}
                  className={`flex items-center justify-between rounded-sm border p-3 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 hover:border-primary/50 hover:bg-primary/5 dark:border-gray-700 dark:hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={network.logo}
                      alt={network.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-primary">{network.name}</span>
                      <span className="text-xs text-secondary">
                        {isCustom ? 'Custom RPC configured' : 'Using default Alchemy RPC'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCustom && <div className="h-2 w-2 rounded-full bg-green-500" />}
                    <button
                      type="button"
                      onClick={() => handleNetworkSelect(chainId)}
                      className="rounded-sm px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                    >
                      {isCustom ? 'Edit' : 'Configure'}
                    </button>
                  </div>
                </button>
              );
            })}
        </div>

        {selectedNetwork && (
          <div className="rounded-sm border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src={networks.find((n) => n.network === selectedNetwork)?.logo || ''}
                  alt={networks.find((n) => n.network === selectedNetwork)?.name || ''}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
                <span className="text-sm font-medium text-primary">
                  Configure {networks.find((n) => n.network === selectedNetwork)?.name} RPC
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    placeholder="Enter custom RPC URL (leave empty to use default)"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className={`bg-hovered h-10 w-full truncate rounded p-2 pr-16 text-sm focus:border-primary focus:outline-none ${
                      error ? 'border border-red-500 focus:border-red-500' : ''
                    }`}
                  />
                  <Button
                    variant="cta"
                    size="sm"
                    onPress={() => void handleSave()}
                    isDisabled={isValidating}
                    className="absolute right-1 top-1/2 flex min-w-[60px] -translate-y-1/2 transform items-center justify-center"
                  >
                    {isValidating ? (
                      <Spinner size={14} width={2} color="text-white" />
                    ) : (
                      <span className="truncate">Save</span>
                    )}
                  </Button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>

              {isUsingCustomRpc(selectedNetwork) && (
                <div className="flex justify-center">
                  <Button variant="secondary" size="sm" onPress={handleReset}>
                    Reset to Default
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

export function AdvancedRpcSettings() {
  const { hasAnyCustomRpcs, customRpcUrls } = useCustomRpcContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const customRpcCount = Object.keys(customRpcUrls).length;

  return (
    <>
      <div className="flex flex-col gap-4">
        <h2 className="text font-monospace text-secondary">Advanced</h2>

        <div className="bg-surface rounded p-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-medium text-primary">Custom RPC Endpoints</h3>
              <p className="text-sm text-secondary">
                Configure custom RPC URLs for blockchain networks to override default Alchemy
                endpoints.
              </p>
              <p className="mt-2 text-xs text-secondary opacity-80">
                Custom RPCs will be used for both frontend wallet connections and backend API calls.
                {hasAnyCustomRpcs() && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    {customRpcCount} custom RPC{customRpcCount !== 1 ? 's' : ''} configured
                  </span>
                )}
              </p>
            </div>

            <Button variant="interactive" size="sm" onPress={() => setIsModalOpen(true)}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      <RpcModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
