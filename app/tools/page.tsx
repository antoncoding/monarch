'use client';

import React from 'react';
import { encodeFunctionData, isAddress, maxUint256, zeroAddress } from 'viem';
import { useChainId, useConnection, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import Header from '@/components/layout/header/Header';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useMorphoAuthorization } from '@/hooks/useMorphoAuthorization';
import { useStyledToast } from '@/hooks/useStyledToast';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { getNetworkName, SupportedNetworks } from '@/utils/networks';
import NetworkFilter from '@/features/markets/components/filters/network-filter';

export default function ToolsPage() {
  const currentChainId = useChainId();
  const { address: account } = useConnection();
  const { switchChain } = useSwitchChain();
  const [selectedChainId, setSelectedChainId] = React.useState<number>(currentChainId);
  const [addressInput, setAddressInput] = React.useState('');
  const [isValidAddress, setIsValidAddress] = React.useState<boolean | null>(null);
  const [assetAddressInput, setAssetAddressInput] = React.useState('');
  const [isSweepConfirmModalOpen, setIsSweepConfirmModalOpen] = React.useState(false);
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

  const bundlerV2Address = React.useMemo(() => getBundlerV2(selectedChainId as SupportedNetworks), [selectedChainId]);
  const normalizedAssetAddress = React.useMemo(() => assetAddressInput.trim(), [assetAddressInput]);
  const isValidAssetAddress = React.useMemo(() => isAddress(normalizedAssetAddress), [normalizedAssetAddress]);
  const sweepNeedsSwitchChain = currentChainId !== selectedChainId;

  const { sendTransactionAsync: sendBundlerSweepTx, isConfirming: isSweepingBundlerAsset } = useTransactionWithToast({
    toastId: 'tools-bundler-v2-asset-sweep',
    pendingText: 'Sweeping Bundler V2 asset',
    successText: 'Bundler V2 asset swept',
    errorText: 'Failed to sweep Bundler V2 asset',
    chainId: selectedChainId,
    pendingDescription: 'Calling Bundler V2 multicall -> erc20Transfer(asset, wallet, maxUint256).',
    successDescription: 'If Bundler V2 held the asset, it was sent to your wallet.',
  });

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

  const handleOpenSweepConfirm = () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    if (bundlerV2Address === zeroAddress) {
      toast.error('Unsupported network', 'Bundler V2 is not configured for the selected network.');
      return;
    }

    if (!isValidAssetAddress) {
      toast.error('Invalid asset address', 'Please enter a valid ERC20 asset address.');
      return;
    }

    if (sweepNeedsSwitchChain) {
      switchChain({ chainId: selectedChainId });
      return;
    }

    setIsSweepConfirmModalOpen(true);
  };

  const handleConfirmSweep = () => {
    if (!account || !isValidAssetAddress) {
      return;
    }

    const txs: `0x${string}`[] = [
      encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'erc20Transfer',
        args: [normalizedAssetAddress as `0x${string}`, account, maxUint256],
      }),
    ];

    void sendBundlerSweepTx({
      account,
      to: bundlerV2Address as `0x${string}`,
      data: (encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'multicall',
        args: [txs],
      }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
      value: 0n,
      chainId: selectedChainId,
    }).catch((error: unknown) => {
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'Failed to submit Bundler V2 asset sweep.');
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Asset sweep failed', userFacingMessage);
      }
    }).finally(() => {
      setIsSweepConfirmModalOpen(false);
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
      <div className="container h-full gap-8 pb-12">
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

          {/* Bundler V2 Asset Sweep Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text font-monospace text-secondary">Bundler V2 Claim</h2>

            <div className="bg-surface flex flex-col gap-6 rounded p-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium text-primary">Sweep Bundler-held ERC20 balance</h3>
                <p className="text-sm text-secondary">
                  Executes via Bundler V2 multicall on the selected network:
                  <code className="mx-1 rounded bg-hovered px-1 py-0.5 text-xs">erc20Transfer(asset, yourWallet, maxUint256)</code>.
                </p>
                <p className="text-sm text-red-500">
                  ⚠️ This transfers only what Bundler V2 already holds for the asset address.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="w-48">
                  <NetworkFilter
                    selectedNetwork={selectedChainId as SupportedNetworks}
                    setSelectedNetwork={(network) => {
                      if (network) setSelectedChainId(network);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="bundler-asset-address" className="text-xs text-secondary">
                    Asset address
                  </label>
                  <input
                    id="bundler-asset-address"
                    type="text"
                    value={assetAddressInput}
                    onChange={(e) => setAssetAddressInput(e.target.value)}
                    placeholder="0x..."
                    className={`h-12 w-full rounded-sm bg-hovered px-3 py-2 text-sm focus:outline-none ${
                      normalizedAssetAddress.length === 0
                        ? 'focus:border-primary'
                        : isValidAssetAddress
                          ? 'border border-green-500 focus:border-green-500'
                          : 'border border-red-500 focus:border-red-500'
                    }`}
                  />
                </div>

                <div className="text-xs text-secondary">
                  <p>
                    Network: {getNetworkName(selectedChainId)} ({selectedChainId})
                  </p>
                  <p>
                    Bundler V2: {bundlerV2Address === zeroAddress ? 'Not configured' : bundlerV2Address}
                  </p>
                  <p>Recipient: {account ?? 'Connect wallet'}</p>
                </div>

                <Button
                  variant="primary"
                  onClick={handleOpenSweepConfirm}
                  disabled={!account || bundlerV2Address === zeroAddress || !isValidAssetAddress || isSweepingBundlerAsset}
                  className="w-fit"
                >
                  {isSweepingBundlerAsset ? 'Submitting...' : sweepNeedsSwitchChain ? 'Switch Network' : 'Open Claim Confirmation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isSweepConfirmModalOpen}
        onOpenChange={setIsSweepConfirmModalOpen}
        size="md"
        title="Confirm Bundler Sweep"
      >
        {(onClose) => (
          <>
            <ModalHeader
              title="Sweep Bundler Asset"
              description="This submits a single Bundler V2 multicall on the selected network."
              onClose={onClose}
            />
            <ModalBody>
              <div className="rounded-sm border border-white/10 bg-hovered p-3 text-xs text-secondary">
                <p>Method: multicall([erc20Transfer(asset, recipient, maxUint256)])</p>
                <p>
                  Network: {getNetworkName(selectedChainId)} ({selectedChainId})
                </p>
                <p>Asset: {normalizedAssetAddress}</p>
                <p>Recipient: {account ?? 'N/A'}</p>
                <p>Bundler V2: {bundlerV2Address}</p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSweep}
                disabled={!account || !isValidAssetAddress || isSweepingBundlerAsset}
              >
                {isSweepingBundlerAsset ? 'Submitting...' : 'Confirm Sweep'}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
