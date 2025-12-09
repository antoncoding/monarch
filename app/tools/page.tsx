'use client';

import React from 'react';
import { isAddress } from 'viem';
import { useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import { useMorphoAuthorization } from '@/hooks/useMorphoAuthorization';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getNetworkName, type SupportedNetworks } from '@/utils/networks';
import NetworkFilter from 'app/markets/components/NetworkFilter';

export default function ToolsPage() {
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [selectedChainId, setSelectedChainId] = React.useState<number>(currentChainId);
  const [addressInput, setAddressInput] = React.useState('');
  const [isValidAddress, setIsValidAddress] = React.useState<boolean | null>(null);
  const toast = useStyledToast();

  const needsSwitchChain = currentChainId !== selectedChainId;

  // Initialize selected chain to current chain on first mount only
  React.useEffect(() => {
    setSelectedChainId(currentChainId);
  }, []);

  const {
    isBundlerAuthorized: isAuthorized,
    isAuthorizingBundler: isAuthorizing,
    authorizeWithTransaction,
    refetchIsBundlerAuthorized: refetchIsAuthorized,
  } = useMorphoAuthorization({
    chainId: selectedChainId,
    authorized: (isValidAddress ? addressInput : '0x0000000000000000000000000000000000000000') as `0x${string}`,
  });

  // Validate address on input change
  React.useEffect(() => {
    if (!addressInput) {
      setIsValidAddress(null);
      return;
    }

    const valid = isAddress(addressInput);
    setIsValidAddress(valid);
  }, [addressInput]);

  // Refetch authorization status when address or chain changes
  React.useEffect(() => {
    if (isValidAddress && addressInput) {
      void refetchIsAuthorized();
    }
  }, [isValidAddress, addressInput, selectedChainId, refetchIsAuthorized]);

  const handleAuthorize = () => {
    if (!isValidAddress || !addressInput) {
      toast.error('Invalid Address', 'Please enter a valid Ethereum address');
      return;
    }

    if (needsSwitchChain) {
      switchChain({ chainId: selectedChainId });
      return;
    }

    void authorizeWithTransaction(true).then((success) => {
      if (success) {
        void refetchIsAuthorized();
      }
    });
  };

  const handleRevoke = () => {
    if (!isValidAddress || !addressInput) {
      toast.error('Invalid Address', 'Please enter a valid Ethereum address');
      return;
    }

    if (needsSwitchChain) {
      switchChain({ chainId: selectedChainId });
      return;
    }

    void authorizeWithTransaction(false).then((success) => {
      if (success) {
        void refetchIsAuthorized();
      }
    });
  };

  const getInputClassName = () => {
    let baseClass = 'h-14 w-full rounded-sm bg-hovered px-3 py-2 text-sm focus:border-primary focus:outline-none';

    if (addressInput && isValidAddress === false) {
      baseClass += ' border border-red-500 focus:border-red-500';
    } else if (addressInput && isValidAddress === true) {
      baseClass += ' border border-green-500 focus:border-green-500';
    }

    return baseClass;
  };

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[4%] pb-12">
        <h1 className="py-8 font-zen">Tools</h1>

        <div className="flex flex-col gap-6">
          {/* Morpho Blue Authorization Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text font-monospace text-secondary">Morpho Blue Authorization</h2>

            <div className="bg-surface flex flex-col gap-6 rounded p-6">
              {/* Description */}
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium text-primary">Authorize Address on Morpho Blue</h3>
                <p className="text-sm text-secondary">
                  You can authorize a custom address or contract to manage your Morpho Blue position. This allows the authorized address to
                  supply, borrow, withdraw, and repay on your behalf.
                </p>
                <p className="text-sm text-red-500">
                  ⚠️ Warning: Only authorize audited contracts or addresses you control. An authorized address has full control over your
                  Morpho Blue positions.
                </p>
              </div>

              {/* Input Row: Network, Address, Button */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {/* Network Selector */}
                  <div className="w-48 flex-shrink-0">
                    <NetworkFilter
                      selectedNetwork={selectedChainId as SupportedNetworks}
                      setSelectedNetwork={(network) => {
                        if (network) setSelectedChainId(network);
                      }}
                    />
                  </div>

                  {/* Address Input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="0x..."
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      className={getInputClassName()}
                    />
                  </div>

                  {/* Action Buttons */}
                  {isAuthorized === true ? (
                    <Button
                      variant="default"
                      onClick={handleRevoke}
                      disabled={!isValidAddress || !addressInput || isAuthorizing}
                      className="flex-shrink-0"
                    >
                      {isAuthorizing ? 'Revoking...' : needsSwitchChain ? 'Switch Network' : 'Revoke'}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleAuthorize}
                      disabled={!isValidAddress || !addressInput || isAuthorizing}
                      className="flex-shrink-0"
                    >
                      {isAuthorizing ? 'Authorizing...' : needsSwitchChain ? 'Switch Network' : 'Authorize'}
                    </Button>
                  )}
                </div>

                {/* Feedback Messages */}
                <div className="min-h-4">
                  {addressInput && isValidAddress === false && <p className="text-xs text-red-500">Invalid address</p>}
                  {addressInput && isValidAddress === true && isAuthorized === true && (
                    <p className="text-xs text-green-500">✓ Authorized on {getNetworkName(selectedChainId)}</p>
                  )}
                  {addressInput && isValidAddress === true && isAuthorized === false && !needsSwitchChain && (
                    <p className="text-xs text-secondary">Not authorized</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
