'use client';

import { useState, useMemo, useCallback } from 'react';
import { type Address, formatUnits } from 'viem';
import { BsArrowRepeat } from 'react-icons/bs';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import Input from '@/components/Input/Input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { usePublicAllocator } from '@/hooks/usePublicAllocator';
import { usePublicAllocatorVaults } from '@/hooks/usePublicAllocatorVaults';
import { usePublicAllocatorLiveData } from '@/hooks/usePublicAllocatorLiveData';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import {
  getVaultPullableAmount,
  getVaultPullableAmountLive,
  autoAllocateWithdrawals,
  autoAllocateWithdrawalsLive,
} from '@/utils/public-allocator';
import type { Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

type PullLiquidityModalProps = {
  market: Market;
  network: SupportedNetworks;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

/**
 * Modal for pulling liquidity into a market via the Public Allocator.
 *
 * Flow: pick vault → enter amount → pull.
 * System auto-allocates across source markets (greedy, most liquid first).
 *
 * Uses API data as seed (vault list, names) and RPC for live verification
 * (flow caps, positions, liquidity). Gracefully falls back to API data if RPC fails.
 */
export function PullLiquidityModal({ market, network, onOpenChange, onSuccess }: PullLiquidityModalProps) {
  const [selectedVaultAddress, setSelectedVaultAddress] = useState<string | null>(null);
  const [pullAmount, setPullAmount] = useState<bigint>(0n);

  const supplyingVaults = market.supplyingVaults ?? [];
  const supplyingVaultAddresses = useMemo(() => supplyingVaults.map((v) => v.address), [supplyingVaults]);
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[network];
  const isNetworkSupported = !!allocatorAddress;
  const chainId = market.morphoBlue.chain.id;
  const decimals = market.loanAsset.decimals;
  const symbol = market.loanAsset.symbol;

  // Batch-fetch all PA-enabled vaults upfront (API data)
  const { vaults: paVaults, isLoading: isVaultsLoading, error: vaultsError } = usePublicAllocatorVaults(supplyingVaultAddresses, network);

  // Only show vaults with pullable liquidity (using API data for the initial list)
  const vaultsWithLiquidity = useMemo(
    () =>
      paVaults
        .map((v) => ({ vault: v, pullable: getVaultPullableAmount(v, market.uniqueKey) }))
        .filter(({ pullable }) => pullable > 0n)
        .sort((a, b) => (b.pullable > a.pullable ? 1 : b.pullable < a.pullable ? -1 : 0)),
    [paVaults, market.uniqueKey],
  );

  const selectedEntry = useMemo(
    () => vaultsWithLiquidity.find(({ vault }) => vault.address === selectedVaultAddress) ?? null,
    [vaultsWithLiquidity, selectedVaultAddress],
  );
  const selectedVault = selectedEntry?.vault ?? null;
  const apiMaxPullable = selectedEntry?.pullable ?? 0n;

  // ── Live on-chain data for the selected vault ──
  const selectedVaultMarketIds = useMemo(() => selectedVault?.state.allocation.map((a) => a.market.uniqueKey) ?? [], [selectedVault]);

  const {
    liveData,
    isLoading: isLiveDataLoading,
    error: _liveDataError,
  } = usePublicAllocatorLiveData(selectedVault?.address as Address | undefined, network, selectedVaultMarketIds, !!selectedVault);

  // Compute live-verified max pullable (falls back to API if live data unavailable)
  const liveMaxPullable = useMemo(() => {
    if (!selectedVault || !liveData) return null;
    return getVaultPullableAmountLive(selectedVault, market.uniqueKey, liveData);
  }, [selectedVault, market.uniqueKey, liveData]);

  const maxPullable = liveMaxPullable ?? apiMaxPullable;

  const parsedAmount = pullAmount;

  // Auto-compute withdrawals using live data when available
  const autoWithdrawals = useMemo(() => {
    if (!selectedVault || parsedAmount <= 0n) return [];
    if (liveData) {
      return autoAllocateWithdrawalsLive(selectedVault, market.uniqueKey, parsedAmount, liveData);
    }
    return autoAllocateWithdrawals(selectedVault, market.uniqueKey, parsedAmount);
  }, [selectedVault, market.uniqueKey, parsedAmount, liveData]);

  // Validation
  const validationError = useMemo(() => {
    if (parsedAmount === 0n) return 'Enter an amount';
    if (parsedAmount > maxPullable) return 'Exceeds available liquidity';

    const totalAllocated = autoWithdrawals.reduce((sum, w) => sum + w.amount, 0n);
    if (totalAllocated < parsedAmount) return 'Not enough liquidity across source markets';

    return null;
  }, [parsedAmount, maxPullable, autoWithdrawals]);

  // Transaction hook
  const { pullLiquidity, isConfirming } = usePublicAllocator({
    vaultAddress: selectedVaultAddress as Address | undefined,
    chainId: network,
    fee: selectedVault?.feeBigInt,
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
    },
  });

  const handleVaultSelect = useCallback((address: string) => {
    setSelectedVaultAddress(address);
    setPullAmount(0n);
  }, []);

  const handlePullLiquidity = useCallback(async () => {
    if (!market.collateralAsset || !selectedVault || autoWithdrawals.length === 0) return;

    const allocationMap = new Map(selectedVault.state.allocation.map((a) => [a.market.uniqueKey, a]));

    const sources = autoWithdrawals
      .map(({ marketKey, amount }) => {
        const alloc = allocationMap.get(marketKey);
        if (!alloc) return null;
        return {
          marketParams: {
            loanToken: alloc.market.loanAsset.address as Address,
            collateralToken: (alloc.market.collateralAsset?.address ?? ZERO_ADDRESS) as Address,
            oracle: (alloc.market.oracle?.address ?? ZERO_ADDRESS) as Address,
            irm: alloc.market.irmAddress as Address,
            lltv: BigInt(alloc.market.lltv),
          },
          amount,
          sortKey: marketKey,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (sources.length === 0) return;

    const targetMarketParams = {
      loanToken: market.loanAsset.address as Address,
      collateralToken: market.collateralAsset.address as Address,
      oracle: market.oracleAddress as Address,
      irm: market.irmAddress as Address,
      lltv: BigInt(market.lltv),
    };

    await pullLiquidity(sources, targetMarketParams);
  }, [selectedVault, autoWithdrawals, market, pullLiquidity]);

  const canExecute = !!selectedVault && parsedAmount > 0n && !validationError && !isConfirming;

  const isVerifyingLive = !!selectedVault && isLiveDataLoading && !liveData;

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="2xl"
      title="Pull Liquidity"
    >
      <ModalHeader
        title="Pull Liquidity"
        description={`Pull liquidity into the ${symbol}/${market.collateralAsset?.symbol ?? 'idle'} market from vault reserves`}
        mainIcon={<BsArrowRepeat className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />

      <ModalBody>
        {isNetworkSupported ? (
          isVaultsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Spinner size={20} />
              <span className="text-sm text-secondary">Loading vaults...</span>
            </div>
          ) : vaultsError ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
              Failed to load vault data.
            </div>
          ) : vaultsWithLiquidity.length === 0 ? (
            <div className="rounded border border-border bg-surface-soft p-4 text-center text-sm text-secondary">
              No vaults with available liquidity found for this market.
            </div>
          ) : (
            <>
              {/* Vault Selection */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-secondary">Source Vault</p>
                <div className="space-y-1">
                  {vaultsWithLiquidity.map(({ vault, pullable }) => {
                    const isSelected = selectedVaultAddress === vault.address;
                    // Show live-verified pullable for the selected vault
                    const displayPullable = isSelected && liveMaxPullable !== null ? liveMaxPullable : pullable;
                    return (
                      <button
                        type="button"
                        key={vault.address}
                        onClick={() => handleVaultSelect(vault.address)}
                        className={`flex w-full items-center justify-between rounded border px-3 py-2.5 text-left text-sm transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-400/10'
                            : 'border-border bg-surface-soft hover:bg-surface-dark'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <TokenIcon
                            address={vault.asset.address}
                            chainId={chainId}
                            symbol={vault.asset.symbol}
                            width={20}
                            height={20}
                          />
                          <span className="font-medium">{vault.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-xs text-secondary">
                            {Number(formatUnits(displayPullable, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                            {symbol}
                          </span>
                          {isSelected && isVerifyingLive && <Spinner size={10} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Input */}
              {selectedVault && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="mb-2 text-xs uppercase tracking-wider text-secondary">Pull Amount</p>
                    <button
                      type="button"
                      onClick={() => setPullAmount(maxPullable)}
                      className="cursor-pointer font-inter text-xs opacity-50 transition hover:opacity-100"
                    >
                      Liquidity: {Number(formatUnits(maxPullable, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                      {symbol}
                      {isVerifyingLive && (
                        <span className="ml-1 inline-block">
                          <Spinner size={10} />
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      decimals={decimals}
                      max={maxPullable}
                      setValue={setPullAmount}
                      exceedMaxErrMessage="Exceeds available liquidity"
                      value={pullAmount}
                      inputClassName="h-10 rounded bg-hovered px-3 py-2 text-base font-medium tabular-nums"
                    />
                  </div>
                  {validationError && parsedAmount > 0n && <p className="mt-1 text-sm text-red-500">{validationError}</p>}
                </div>
              )}

              {/* Show fee if there is any */}
              {selectedVault && selectedVault.feeBigInt !== 0n && parsedAmount > 0n && !validationError && (
                <div className="space-y-2 rounded border border-border bg-surface-soft p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">Fee</span>
                    <span className="tabular-nums text-xs">{formatUnits(selectedVault.feeBigInt, 18)} ETH</span>
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-300">
            Public Allocator is not available on this network.
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          variant="default"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        {isNetworkSupported && selectedVault && (
          <ExecuteTransactionButton
            targetChainId={chainId}
            onClick={() => {
              handlePullLiquidity().catch(console.error);
            }}
            disabled={!canExecute}
            isLoading={isConfirming}
            variant="primary"
          >
            {isConfirming ? 'Pulling Liquidity...' : 'Pull Liquidity'}
          </ExecuteTransactionButton>
        )}
      </ModalFooter>
    </Modal>
  );
}
