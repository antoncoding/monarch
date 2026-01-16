'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useStyledToast } from '@/hooks/useStyledToast';
import { type SupportedNetworks, networks } from '@/utils/networks';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';

const getNetworkByChainId = (chainId: SupportedNetworks) => networks.find((n) => n.network === chainId);

async function validateRpcUrl(url: string, expectedChainId: number): Promise<{ isValid: boolean; error?: string }> {
  if (!url.trim()) {
    return { isValid: true };
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }

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
      return {
        isValid: false,
        error: `RPC server responded with ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      error?: { message: string };
      result?: string;
    };
    if (data.error) {
      return { isValid: false, error: `RPC error: ${data.error.message}` };
    }

    const chainId = Number.parseInt(data.result ?? '0x0', 16);
    if (chainId !== expectedChainId) {
      const networkName = getNetworkByChainId(expectedChainId as SupportedNetworks)?.name;
      return {
        isValid: false,
        error: `Chain ID mismatch: expected ${expectedChainId} (${networkName}) but got ${chainId}`,
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to connect to RPC: ${error instanceof Error ? error.message : 'Network error'}`,
    };
  }
}

export function RpcDetail() {
  const { customRpcUrls, setRpcUrl, resetRpcUrl, resetAllRpcUrls, isUsingCustomRpc } = useCustomRpcContext();
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const { success, error: toastError } = useStyledToast();

  const selectedNetworkInfo = useMemo(() => (selectedNetwork ? getNetworkByChainId(selectedNetwork) : null), [selectedNetwork]);

  const handleNetworkSelect = (chainId: SupportedNetworks) => {
    const currentRpcUrl = customRpcUrls[chainId] ?? '';
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
      const validation = await validateRpcUrl(url, selectedNetwork);

      if (!validation.isValid) {
        setError(validation.error ?? 'Invalid RPC URL');
        setIsValidating(false);
        return;
      }

      setRpcUrl(selectedNetwork, url || undefined);

      if (url) {
        success('RPC Updated', `Custom RPC configured for ${selectedNetworkInfo?.name}. Please refresh the page to apply changes.`);
      } else {
        success('RPC Reset', `${selectedNetworkInfo?.name} now uses default Alchemy RPC. Please refresh the page to apply changes.`);
      }

      setError('');
      setInputValue('');
      setSelectedNetwork(null);
    } catch (_validationError) {
      toastError('Validation Failed', 'Unable to validate RPC endpoint');
      setError('Failed to validate RPC endpoint');
    } finally {
      setIsValidating(false);
    }
  };

  const handleReset = () => {
    if (!selectedNetwork) return;

    resetRpcUrl(selectedNetwork);
    success('RPC Reset', `${selectedNetworkInfo?.name} reset to default Alchemy RPC. Please refresh the page to apply changes.`);

    setInputValue('');
    setError('');
    setSelectedNetwork(null);
  };

  const handleResetAll = () => {
    const customCount = Object.keys(customRpcUrls).length;
    resetAllRpcUrls();
    success(
      'All RPCs Reset',
      `${customCount} custom RPC${customCount !== 1 ? 's' : ''} reset to default. Please refresh the page to apply changes.`,
    );

    setSelectedNetwork(null);
    setInputValue('');
    setError('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Reset All Button */}
      <div className="flex justify-end">
        <Button
          variant="default"
          size="sm"
          onClick={handleResetAll}
          disabled={Object.keys(customRpcUrls).length === 0}
        >
          Reset All
        </Button>
      </div>

      {/* Network List */}
      <div className="flex flex-col gap-1.5">
        {networks.map((network) => {
          const chainId = network.network;
          const isCustom = isUsingCustomRpc(chainId);
          const isSelected = selectedNetwork === chainId;

          return (
            <button
              key={chainId}
              type="button"
              onClick={() => handleNetworkSelect(chainId)}
              className={`flex items-center justify-between rounded border p-2.5 text-left transition-all duration-200 ${
                isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Image
                  src={network.logo}
                  alt={network.name}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-primary">{network.name}</span>
                  <span className="text-[10px] text-secondary">{isCustom ? 'Custom RPC configured' : 'Using default Alchemy RPC'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isCustom && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                <span className="rounded px-2 py-1 text-[10px] font-medium text-primary">{isCustom ? 'Edit' : 'Configure'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Configuration Panel */}
      {selectedNetworkInfo && (
        <div className="rounded border border-border p-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src={selectedNetworkInfo.logo}
                alt={selectedNetworkInfo.name}
                width={18}
                height={18}
                className="rounded-full"
              />
              <span className="text-xs font-medium text-primary">Configure {selectedNetworkInfo.name} RPC</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Enter custom RPC URL (leave empty to use default)"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className={`bg-hovered h-9 w-full truncate rounded p-2 pr-16 text-xs focus:border-primary focus:outline-none ${
                    error ? 'border border-red-500 focus:border-red-500' : ''
                  }`}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={isValidating}
                  className="absolute right-1 top-1/2 flex min-w-[50px] -translate-y-1/2 transform items-center justify-center"
                >
                  {isValidating ? (
                    <Spinner
                      size={12}
                      width={2}
                      color="text-white"
                    />
                  ) : (
                    <span className="truncate text-[11px]">Save</span>
                  )}
                </Button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            {selectedNetwork && isUsingCustomRpc(selectedNetwork) && (
              <div className="flex justify-center">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleReset}
                >
                  Reset to Default
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
