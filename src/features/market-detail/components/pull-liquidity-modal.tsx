'use client';

import { useState, useMemo, useCallback } from 'react';
import { type Address, formatUnits, parseUnits } from 'viem';
import { BsArrowRepeat } from 'react-icons/bs';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { usePublicAllocator } from '@/hooks/usePublicAllocator';
import { usePublicAllocatorVaults, type ProcessedPublicAllocatorVault } from '@/hooks/usePublicAllocatorVaults';
import { usePublicAllocatorLiveData, type LiveMarketData } from '@/hooks/usePublicAllocatorLiveData';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
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
 * Calculate max pullable liquidity from a vault into the target market (API data only).
 *
 * Bounded by:
 * 1. Per-source: min(flowCap.maxOut, vaultSupply, marketLiquidity)
 * 2. Target market: flowCap.maxIn
 * 3. Target market: supplyCap - currentSupply (remaining vault capacity)
 */
function getVaultPullableAmount(vault: ProcessedPublicAllocatorVault, targetMarketKey: string): bigint {
  let total = 0n;

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const cap = vault.flowCapsByMarket.get(alloc.market.uniqueKey);
    if (!cap || cap.maxOut === 0n) continue;

    const vaultSupply = BigInt(alloc.supplyAssets);
    const liquidity = BigInt(alloc.market.state.liquidityAssets);

    let pullable = cap.maxOut;
    if (vaultSupply < pullable) pullable = vaultSupply;
    if (liquidity < pullable) pullable = liquidity;
    if (pullable > 0n) total += pullable;
  }

  // Cap by target market's maxIn flow cap
  const targetCap = vault.flowCapsByMarket.get(targetMarketKey);
  if (!targetCap) {
    return 0n;
  }
  if (total > targetCap.maxIn) {
    total = targetCap.maxIn;
  }

  // Cap by remaining supply cap for the target market in this vault
  const targetAlloc = vault.state.allocation.find((a) => a.market.uniqueKey === targetMarketKey);
  if (targetAlloc) {
    const supplyCap = BigInt(targetAlloc.supplyCap);
    const currentSupply = BigInt(targetAlloc.supplyAssets);
    const remainingCap = supplyCap > currentSupply ? supplyCap - currentSupply : 0n;
    if (total > remainingCap) total = remainingCap;
  }

  return total;
}

/**
 * Calculate max pullable liquidity using live on-chain data for flow caps,
 * vault supply, and market liquidity.
 *
 * Falls back to API values for supply cap constraints (which are less volatile).
 */
function getVaultPullableAmountLive(
  vault: ProcessedPublicAllocatorVault,
  targetMarketKey: string,
  liveData: Map<string, LiveMarketData>,
): bigint {
  let total = 0n;

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const live = liveData.get(alloc.market.uniqueKey);
    if (!live || live.maxOut === 0n) continue;

    let pullable = live.maxOut;
    if (live.vaultSupplyAssets < pullable) pullable = live.vaultSupplyAssets;
    if (live.marketLiquidity < pullable) pullable = live.marketLiquidity;
    if (pullable > 0n) total += pullable;
  }

  // Cap by target market's live maxIn flow cap
  const targetLive = liveData.get(targetMarketKey);
  if (!targetLive) {
    return 0n;
  }
  if (total > targetLive.maxIn) {
    total = targetLive.maxIn;
  }

  // Cap by remaining supply cap (uses API data — supply caps rarely change)
  const targetAlloc = vault.state.allocation.find((a) => a.market.uniqueKey === targetMarketKey);
  if (targetAlloc) {
    const supplyCap = BigInt(targetAlloc.supplyCap);
    // Use live supply if available, fall back to API
    const currentSupply = targetLive.vaultSupplyAssets;
    const remainingCap = supplyCap > currentSupply ? supplyCap - currentSupply : 0n;
    if (total > remainingCap) total = remainingCap;
  }

  return total;
}

/**
 * Auto-allocate a pull amount across source markets greedily (API data).
 * Pulls from the most liquid source first.
 */
function autoAllocateWithdrawals(
  vault: ProcessedPublicAllocatorVault,
  targetMarketKey: string,
  requestedAmount: bigint,
): { marketKey: string; amount: bigint }[] {
  const sources: { marketKey: string; maxPullable: bigint }[] = [];

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const cap = vault.flowCapsByMarket.get(alloc.market.uniqueKey);
    if (!cap || cap.maxOut === 0n) continue;

    const vaultSupply = BigInt(alloc.supplyAssets);
    const liquidity = BigInt(alloc.market.state.liquidityAssets);

    let maxPullable = cap.maxOut;
    if (vaultSupply < maxPullable) maxPullable = vaultSupply;
    if (liquidity < maxPullable) maxPullable = liquidity;

    if (maxPullable > 0n) {
      sources.push({ marketKey: alloc.market.uniqueKey, maxPullable });
    }
  }

  sources.sort((a, b) => (b.maxPullable > a.maxPullable ? 1 : b.maxPullable < a.maxPullable ? -1 : 0));

  const withdrawals: { marketKey: string; amount: bigint }[] = [];
  let remaining = requestedAmount;

  for (const source of sources) {
    if (remaining <= 0n) break;
    const pullAmount = remaining < source.maxPullable ? remaining : source.maxPullable;
    withdrawals.push({ marketKey: source.marketKey, amount: pullAmount });
    remaining -= pullAmount;
  }

  return withdrawals;
}

/**
 * Auto-allocate a pull amount across source markets using live on-chain data.
 * Same greedy algorithm but uses RPC-verified flow caps, supply, and liquidity.
 */
function autoAllocateWithdrawalsLive(
  vault: ProcessedPublicAllocatorVault,
  targetMarketKey: string,
  requestedAmount: bigint,
  liveData: Map<string, LiveMarketData>,
): { marketKey: string; amount: bigint }[] {
  const sources: { marketKey: string; maxPullable: bigint }[] = [];

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const live = liveData.get(alloc.market.uniqueKey);
    if (!live || live.maxOut === 0n) continue;

    let maxPullable = live.maxOut;
    if (live.vaultSupplyAssets < maxPullable) maxPullable = live.vaultSupplyAssets;
    if (live.marketLiquidity < maxPullable) maxPullable = live.marketLiquidity;

    if (maxPullable > 0n) {
      sources.push({ marketKey: alloc.market.uniqueKey, maxPullable });
    }
  }

  sources.sort((a, b) => (b.maxPullable > a.maxPullable ? 1 : b.maxPullable < a.maxPullable ? -1 : 0));

  const withdrawals: { marketKey: string; amount: bigint }[] = [];
  let remaining = requestedAmount;

  for (const source of sources) {
    if (remaining <= 0n) break;
    const pullAmount = remaining < source.maxPullable ? remaining : source.maxPullable;
    withdrawals.push({ marketKey: source.marketKey, amount: pullAmount });
    remaining -= pullAmount;
  }

  return withdrawals;
}

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
  const [pullAmount, setPullAmount] = useState('');

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

  // Parse pull amount
  const parsedAmount = useMemo(() => {
    if (!pullAmount || pullAmount === '' || pullAmount === '0') return 0n;
    try {
      return parseUnits(pullAmount, decimals);
    } catch {
      return 0n;
    }
  }, [pullAmount, decimals]);

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
    setPullAmount('');
  }, []);

  const handleSetMax = useCallback(() => {
    if (maxPullable > 0n) {
      setPullAmount(formatUnits(maxPullable, decimals));
    }
  }, [maxPullable, decimals]);

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
                      onClick={handleSetMax}
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
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.0"
                      value={pullAmount}
                      onChange={(e) => setPullAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === 'e') e.preventDefault();
                      }}
                      className="bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none"
                    />
                    {maxPullable > 0n && (
                      <button
                        type="button"
                        onClick={handleSetMax}
                        className="bg-surface absolute right-2 top-1/2 -translate-y-1/2 transform rounded p-1 text-sm text-secondary opacity-80 duration-300 ease-in-out hover:scale-105 hover:opacity-100"
                      >
                        Max
                      </button>
                    )}
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
