'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { FiArrowUpRight } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useMorphoMarketAdapters } from '@/hooks/useMorphoMarketAdapters';
import { useVaultAllocations } from '@/hooks/useVaultAllocations';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketAllocation } from '@/types/vaultAllocations';

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

  // Fetch vault data
  const { data: vaultData, isLoading: vaultDataLoading } = useVaultV2Data({ vaultAddress, chainId });

  // Vault hook for transactions
  const { withdraw, withdrawFromMarket, isWithdrawing, userAssets } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
    onTransactionSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  // Check if user is an allocator
  const isAllocator = useMemo(() => {
    if (!connectedAddress || !vaultData?.allocators) return false;
    return vaultData.allocators.some((a) => a.toLowerCase() === connectedAddress.toLowerCase());
  }, [connectedAddress, vaultData?.allocators]);
  const { marketAllocations, loading: allocationsLoading } = useVaultAllocations({
    vaultAddress,
    chainId,
    enabled: isAllocator,
  });
  const { primaryAdapter, isLoading: adaptersLoading } = useMorphoMarketAdapters({
    vaultAddress,
    chainId,
  });

  // Filter markets with positive allocations
  const marketsWithAllocation = useMemo(() => {
    if (!isAllocator) return [];
    return marketAllocations.filter((m) => m.allocation > 0n);
  }, [isAllocator, marketAllocations]);

  // Allocators can route through a market; regular users withdraw through the vault's configured liquidity path.
  const maxWithdrawable = useMemo(() => {
    const userAssetBalance = userAssets ?? 0n;
    if (!isAllocator || !selectedMarket) return userAssetBalance;

    const allocation = selectedMarket.allocation;
    const liquidity = BigInt(selectedMarket.market.state?.liquidityAssets ?? '0');
    const marketLimit = allocation < liquidity ? allocation : liquidity;

    return marketLimit < userAssetBalance ? marketLimit : userAssetBalance;
  }, [isAllocator, selectedMarket, userAssets]);

  // Handle market selection
  const handleSelectMarket = useCallback((market: MarketAllocation) => {
    setSelectedMarket(market);
    setWithdrawAmount(BigInt(0));
    setInputError(null);
  }, []);

  // Handle withdraw
  const handleWithdraw = useCallback(async () => {
    if (!connectedAddress) return;

    if (isAllocator && selectedMarket && primaryAdapter) {
      await withdrawFromMarket(withdrawAmount, connectedAddress, selectedMarket.market, primaryAdapter);
      return;
    }

    await withdraw(withdrawAmount, connectedAddress);
  }, [connectedAddress, isAllocator, selectedMarket, primaryAdapter, withdrawFromMarket, withdrawAmount, withdraw]);

  const isLoading = vaultDataLoading || (isAllocator && (allocationsLoading || adaptersLoading));
  const showMarketSelection = isAllocator;
  const showAmountInput = !showMarketSelection || selectedMarket !== null;
  const isWithdrawDisabled =
    inputError !== null || withdrawAmount === 0n || (showMarketSelection && (!selectedMarket || !primaryAdapter)) || maxWithdrawable === 0n;

  return (
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
        ) : showMarketSelection && marketsWithAllocation.length === 0 ? (
          <div className="py-8 text-center text-secondary">No markets with allocations to withdraw from.</div>
        ) : (
          <div className="space-y-6">
            {/* Market Selection */}
            {showMarketSelection && (
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
            )}

            {/* Amount Input - only show when market is selected */}
            {showAmountInput && (
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
                    {inputError && <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">{inputError}</p>}
                    {showMarketSelection && !primaryAdapter && (
                      <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">
                        Vault adapter unavailable. Refresh and try again.
                      </p>
                    )}
                  </div>

                  <ExecuteTransactionButton
                    targetChainId={chainId}
                    onClick={handleWithdraw}
                    isLoading={isWithdrawing}
                    disabled={isWithdrawDisabled}
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
  );
}

export default VaultWithdrawModal;
