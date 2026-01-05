'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { FiArrowUpRight } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { TokenIcon } from '@/components/shared/token-icon';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useVaultAllocations } from '@/hooks/useVaultAllocations';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketAllocation } from '@/types/vaultAllocations';
import { VaultWithdrawProcessModal } from './vault-withdraw-process-modal';

type VaultWithdrawModalProps = {
  vaultAddress: Address;
  vaultName: string;
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  chainId: SupportedNetworks;
  onSuccess?: () => void;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
};

export function VaultWithdrawModal({
  vaultAddress,
  vaultName,
  assetSymbol,
  assetDecimals,
  chainId,
  onSuccess,
  onClose,
}: VaultWithdrawModalProps): JSX.Element {
  const { address: connectedAddress } = useConnection();

  // Local state
  const [selectedMarket, setSelectedMarket] = useState<MarketAllocation | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));
  const [inputError, setInputError] = useState<string | null>(null);
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<'preparing' | 'withdrawing'>('preparing');

  // Fetch vault data
  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { marketAllocations, loading: allocationsLoading } = useVaultAllocations({ vaultAddress, chainId });
  const { morphoMarketV1Adapter, isLoading: adaptersLoading } = useMorphoMarketV1Adapters({ vaultAddress, chainId });

  // Vault hook for transactions
  const { withdrawFromMarket, isWithdrawing, isOwner } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
    onTransactionSuccess: () => {
      setShowProcessModal(false);
      onSuccess?.();
      onClose();
    },
  });

  // Check if user is an allocator
  const isAllocator = useMemo(() => {
    if (!connectedAddress || !vaultData?.allocators) return false;
    return vaultData.allocators.some((a) => a.toLowerCase() === connectedAddress.toLowerCase());
  }, [connectedAddress, vaultData?.allocators]);

  // Filter markets with positive allocations
  const marketsWithAllocation = useMemo(() => {
    return marketAllocations.filter((m) => m.allocation > 0n);
  }, [marketAllocations]);

  // Calculate max withdrawable for selected market (min of allocation and liquidity)
  const maxWithdrawable = useMemo(() => {
    if (!selectedMarket) return BigInt(0);

    const allocation = selectedMarket.allocation;
    const liquidity = BigInt(selectedMarket.market.state?.liquidityAssets ?? '0');

    return allocation < liquidity ? allocation : liquidity;
  }, [selectedMarket]);

  // Handle market selection
  const handleSelectMarket = useCallback((market: MarketAllocation) => {
    setSelectedMarket(market);
    setWithdrawAmount(BigInt(0));
    setInputError(null);
  }, []);

  // Handle withdraw
  const handleWithdraw = useCallback(async () => {
    if (!connectedAddress || !selectedMarket || !morphoMarketV1Adapter) return;

    try {
      setShowProcessModal(true);
      setCurrentStep('preparing');

      // Determine if we need to set self as allocator
      const needsAllocatorSetup = isOwner && !isAllocator;

      setCurrentStep('withdrawing');

      await withdrawFromMarket(
        withdrawAmount,
        connectedAddress,
        selectedMarket.market,
        morphoMarketV1Adapter,
        needsAllocatorSetup,
      );
    } catch (error) {
      console.error('Withdraw failed:', error);
      setShowProcessModal(false);
    }
  }, [connectedAddress, selectedMarket, morphoMarketV1Adapter, isOwner, isAllocator, withdrawFromMarket, withdrawAmount]);

  const isLoading = allocationsLoading || adaptersLoading;

  return (
    <>
      <Modal
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        size="xl"
        scrollBehavior="inside"
        backdrop="blur"
      >
        <ModalHeader
          title={`Withdraw ${assetSymbol}`}
          description={`Withdraw from ${vaultName}`}
          mainIcon={<FiArrowUpRight className="h-5 w-5" />}
          onClose={onClose}
        />
        <ModalBody className="gap-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : marketsWithAllocation.length === 0 ? (
            <div className="py-8 text-center text-secondary">No markets with allocations to withdraw from.</div>
          ) : (
            <div className="space-y-6">
              {/* Market Selection */}
              <div>
                <div className="mb-3 text-sm text-secondary">Select market to withdraw from</div>
                <div className="space-y-2">
                  {marketsWithAllocation.map((marketAllocation) => {
                    const isSelected = selectedMarket?.marketId === marketAllocation.marketId;
                    const liquidity = BigInt(marketAllocation.market.state?.liquidityAssets ?? '0');

                    return (
                      <button
                        key={marketAllocation.marketId}
                        type="button"
                        onClick={() => handleSelectMarket(marketAllocation)}
                        className={`w-full rounded border p-3 text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <MarketIdentity
                            market={marketAllocation.market}
                            chainId={chainId}
                            mode={MarketIdentityMode.Normal}
                          />
                          <div className="text-right">
                            <div className="text-sm">
                              {formatBalance(marketAllocation.allocation, assetDecimals).toFixed(4)} {assetSymbol}
                            </div>
                            <div className="text-xs text-secondary">
                              Global Liquidity: {formatReadable(formatBalance(liquidity, assetDecimals))}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Input - only show when market is selected */}
              {selectedMarket && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary">Withdraw amount</span>
                    <p className="font-inter text-xs text-secondary">
                      Max: {formatBalance(maxWithdrawable, assetDecimals).toFixed(4)} {assetSymbol}
                    </p>
                  </div>

                  <div className="mt-2 flex items-start justify-between">
                    <div className="relative grow">
                      <Input
                        decimals={assetDecimals}
                        max={maxWithdrawable}
                        setValue={setWithdrawAmount}
                        setError={setInputError}
                        exceedMaxErrMessage="Exceeds available amount"
                      />
                      {inputError && (
                        <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">{inputError}</p>
                      )}
                    </div>

                    <ExecuteTransactionButton
                      targetChainId={chainId}
                      onClick={handleWithdraw}
                      isLoading={isWithdrawing}
                      disabled={inputError !== null || !withdrawAmount || withdrawAmount === 0n}
                      variant="primary"
                      className="ml-2 min-w-32"
                    >
                      Withdraw
                    </ExecuteTransactionButton>
                  </div>
                </div>
              )}

            </div>
          )}
        </ModalBody>
      </Modal>

      {showProcessModal && selectedMarket && (
        <VaultWithdrawProcessModal
          currentStep={currentStep}
          onClose={() => setShowProcessModal(false)}
          vaultName={vaultName}
          assetSymbol={assetSymbol}
          amount={withdrawAmount}
          assetDecimals={assetDecimals}
          marketSymbol={`${selectedMarket.market.collateralAsset.symbol}/${selectedMarket.market.loanAsset.symbol}`}
          needsAllocatorSetup={isOwner && !isAllocator}
        />
      )}
    </>
  );
}

export default VaultWithdrawModal;
