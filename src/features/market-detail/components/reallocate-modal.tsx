'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { type Address, formatUnits } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { Modal, ModalHeader, ModalBody } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { usePublicAllocator } from '@/hooks/usePublicAllocator';
import { fetchVaultAllocations, type VaultAllocationData, type VaultAllocation } from '@/data-sources/morpho-api/vault-allocations';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import type { Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type ReallocateModalProps = {
  market: Market;
  network: SupportedNetworks;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

/**
 * Modal for triggering public allocator reallocations.
 * Allows moving liquidity from other vault markets into the current market.
 */
export function ReallocateModal({ market, network, onOpenChange, onSuccess }: ReallocateModalProps) {
  const [selectedVaultAddress, setSelectedVaultAddress] = useState<string | null>(null);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});

  const supplyingVaults = market.supplyingVaults ?? [];
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[network];
  const isNetworkSupported = !!allocatorAddress;

  // Fetch vault allocation data when a vault is selected
  const {
    data: vaultData,
    isLoading: isVaultLoading,
    error: vaultError,
  } = useQuery<VaultAllocationData | null>({
    queryKey: ['vault-allocation', selectedVaultAddress, network],
    queryFn: () => (selectedVaultAddress ? fetchVaultAllocations(selectedVaultAddress, network) : null),
    enabled: !!selectedVaultAddress,
    staleTime: 30_000,
  });

  // Get the source markets (exclude the current target market)
  const sourceMarkets = useMemo(() => {
    if (!vaultData?.state?.allocation) return [];
    return vaultData.state.allocation.filter((alloc) => alloc.market.uniqueKey !== market.uniqueKey);
  }, [vaultData, market.uniqueKey]);

  // Collect market IDs for flow cap queries
  const marketIds = useMemo(() => {
    const ids: `0x${string}`[] = sourceMarkets.map((alloc) => alloc.market.uniqueKey as `0x${string}`);
    // Also include the target market
    ids.push(market.uniqueKey as `0x${string}`);
    return ids;
  }, [sourceMarkets, market.uniqueKey]);

  const { fee, isFeeLoading, flowCaps, isFlowCapsLoading, reallocate, isConfirming } = usePublicAllocator({
    vaultAddress: selectedVaultAddress as Address | undefined,
    chainId: network,
    marketIds: selectedVaultAddress ? marketIds : undefined,
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
    },
  });

  // Build a flow cap lookup map
  const flowCapMap = useMemo(() => {
    const map = new Map<string, { maxIn: bigint; maxOut: bigint }>();
    for (const cap of flowCaps) {
      map.set(cap.marketId, { maxIn: cap.maxIn, maxOut: cap.maxOut });
    }
    return map;
  }, [flowCaps]);

  // Target market flow cap (maxIn)
  const targetFlowCap = flowCapMap.get(market.uniqueKey);

  // Reset withdrawal amounts when vault changes
  useEffect(() => {
    setWithdrawAmounts({});
  }, [selectedVaultAddress]);

  // Calculate total withdrawal
  const totalWithdrawal = useMemo(() => {
    let total = 0n;
    for (const alloc of sourceMarkets) {
      const amountStr = withdrawAmounts[alloc.market.uniqueKey];
      if (amountStr && amountStr !== '0' && amountStr !== '') {
        try {
          const parsed = BigInt(Math.floor(Number(amountStr) * 10 ** market.loanAsset.decimals));
          total += parsed;
        } catch {
          // ignore parse errors
        }
      }
    }
    return total;
  }, [withdrawAmounts, sourceMarkets, market.loanAsset.decimals]);

  // Validation
  const validationError = useMemo(() => {
    if (totalWithdrawal === 0n) return 'Enter withdrawal amounts';

    // Check target market flow cap
    if (targetFlowCap && totalWithdrawal > targetFlowCap.maxIn) {
      return `Exceeds target market max inflow (${formatUnits(targetFlowCap.maxIn, market.loanAsset.decimals)} ${market.loanAsset.symbol})`;
    }

    // Check individual source market flow caps and liquidity
    for (const alloc of sourceMarkets) {
      const amountStr = withdrawAmounts[alloc.market.uniqueKey];
      if (!amountStr || amountStr === '0' || amountStr === '') continue;

      let parsed: bigint;
      try {
        parsed = BigInt(Math.floor(Number(amountStr) * 10 ** market.loanAsset.decimals));
      } catch {
        return 'Invalid amount';
      }

      if (parsed <= 0n) continue;

      const cap = flowCapMap.get(alloc.market.uniqueKey);
      if (cap && parsed > cap.maxOut) {
        const label = alloc.market.collateralAsset?.symbol ?? 'idle';
        return `Exceeds max outflow for ${label} market`;
      }

      const vaultSupply = BigInt(alloc.supplyAssets);
      if (parsed > vaultSupply) {
        const label = alloc.market.collateralAsset?.symbol ?? 'idle';
        return `Exceeds vault supply in ${label} market`;
      }

      const liquidity = BigInt(alloc.market.state.liquidityAssets);
      if (parsed > liquidity) {
        const label = alloc.market.collateralAsset?.symbol ?? 'idle';
        return `Exceeds available liquidity in ${label} market`;
      }
    }

    return null;
  }, [totalWithdrawal, targetFlowCap, sourceMarkets, withdrawAmounts, flowCapMap, market]);

  // Sort withdrawals by market ID (bytes32 ascending) for the contract call
  const handleReallocate = useCallback(async () => {
    const withdrawals: {
      marketParams: {
        loanToken: Address;
        collateralToken: Address;
        oracle: Address;
        irm: Address;
        lltv: bigint;
      };
      amount: bigint;
    }[] = [];

    for (const alloc of sourceMarkets) {
      const amountStr = withdrawAmounts[alloc.market.uniqueKey];
      if (!amountStr || amountStr === '0' || amountStr === '') continue;

      const parsed = BigInt(Math.floor(Number(amountStr) * 10 ** market.loanAsset.decimals));
      if (parsed <= 0n) continue;

      withdrawals.push({
        marketParams: {
          loanToken: alloc.market.loanAsset.address as Address,
          collateralToken: (alloc.market.collateralAsset?.address ?? '0x0000000000000000000000000000000000000000') as Address,
          oracle: alloc.market.oracleAddress as Address,
          irm: alloc.market.irmAddress as Address,
          lltv: BigInt(alloc.market.lltv),
        },
        amount: parsed,
      });
    }

    // Sort by market uniqueKey (bytes32) ascending
    withdrawals.sort((a, b) => {
      // We need to find the uniqueKey for each withdrawal's marketParams
      const aKey = sourceMarkets.find(
        (m) =>
          m.market.loanAsset.address.toLowerCase() === a.marketParams.loanToken.toLowerCase() &&
          (m.market.collateralAsset?.address ?? '0x0000000000000000000000000000000000000000').toLowerCase() ===
            a.marketParams.collateralToken.toLowerCase() &&
          m.market.oracleAddress.toLowerCase() === a.marketParams.oracle.toLowerCase() &&
          m.market.irmAddress.toLowerCase() === a.marketParams.irm.toLowerCase(),
      )?.market.uniqueKey;
      const bKey = sourceMarkets.find(
        (m) =>
          m.market.loanAsset.address.toLowerCase() === b.marketParams.loanToken.toLowerCase() &&
          (m.market.collateralAsset?.address ?? '0x0000000000000000000000000000000000000000').toLowerCase() ===
            b.marketParams.collateralToken.toLowerCase() &&
          m.market.oracleAddress.toLowerCase() === b.marketParams.oracle.toLowerCase() &&
          m.market.irmAddress.toLowerCase() === b.marketParams.irm.toLowerCase(),
      )?.market.uniqueKey;

      if (!aKey || !bKey) return 0;
      return aKey.toLowerCase() < bKey.toLowerCase() ? -1 : aKey.toLowerCase() > bKey.toLowerCase() ? 1 : 0;
    });

    const supplyMarketParams = {
      loanToken: market.loanAsset.address as Address,
      collateralToken: market.collateralAsset.address as Address,
      oracle: market.oracleAddress as Address,
      irm: market.irmAddress as Address,
      lltv: BigInt(market.lltv),
    };

    await reallocate(withdrawals, supplyMarketParams);
  }, [sourceMarkets, withdrawAmounts, market, reallocate]);

  const handleSetMaxForMarket = (alloc: VaultAllocation) => {
    const cap = flowCapMap.get(alloc.market.uniqueKey);
    const maxOut = cap?.maxOut ?? 0n;
    const vaultSupply = BigInt(alloc.supplyAssets);
    const liquidity = BigInt(alloc.market.state.liquidityAssets);

    // Take the minimum of maxOut, vault supply, and available liquidity
    const maxAmount = maxOut < vaultSupply ? (maxOut < liquidity ? maxOut : liquidity) : vaultSupply < liquidity ? vaultSupply : liquidity;

    setWithdrawAmounts((prev) => ({
      ...prev,
      [alloc.market.uniqueKey]: formatUnits(maxAmount, market.loanAsset.decimals),
    }));
  };

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="2xl"
      title="Reallocate Liquidity"
    >
      <ModalHeader
        onClose={() => onOpenChange(false)}
        title="Reallocate Liquidity"
        description="Move liquidity from other vault markets into this market via the Public Allocator"
      />
      <ModalBody>
        <div className="space-y-4">
          {isNetworkSupported ? (
            supplyingVaults.length === 0 ? (
              <div className="rounded border border-border bg-surface-soft p-4 text-center text-sm text-secondary">
                No MetaMorpho vaults supply to this market.
              </div>
            ) : (
              <>
                {/* Step 1: Select a vault */}
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-secondary">Select Vault</p>
                  <div className="space-y-1">
                    {supplyingVaults.map((vault) => (
                      <button
                        type="button"
                        key={vault.address}
                        onClick={() => setSelectedVaultAddress(vault.address)}
                        className={`w-full rounded border px-3 py-2 text-left text-sm transition-colors ${
                          selectedVaultAddress === vault.address
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-400/10'
                            : 'border-border bg-surface-soft hover:bg-surface-dark'
                        }`}
                      >
                        <span className="font-mono text-xs">{vault.address}</span>
                        {selectedVaultAddress === vault.address && vaultData && (
                          <span className="ml-2 text-xs text-secondary">({vaultData.name})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Show vault markets */}
                {selectedVaultAddress && (
                  <div>
                    {isVaultLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Spinner size={20} />
                        <span className="ml-2 text-sm text-secondary">Loading vault data...</span>
                      </div>
                    ) : vaultError ? (
                      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
                        Failed to load vault data. Please try again.
                      </div>
                    ) : sourceMarkets.length === 0 ? (
                      <div className="rounded border border-border bg-surface-soft p-4 text-center text-sm text-secondary">
                        This vault has no other markets to withdraw from.
                      </div>
                    ) : (
                      <>
                        {/* Target market info */}
                        <div className="rounded border border-border bg-surface-soft p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs uppercase tracking-wider text-secondary">Target Market</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <TokenIcon
                                address={market.collateralAsset.address}
                                chainId={market.morphoBlue.chain.id}
                                symbol={market.collateralAsset.symbol}
                                width={16}
                                height={16}
                              />
                              <span className="text-sm">{market.collateralAsset.symbol}</span>
                              {targetFlowCap && (
                                <span className="text-xs text-secondary">
                                  (max inflow: {formatUnits(targetFlowCap.maxIn, market.loanAsset.decimals)} {market.loanAsset.symbol})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Source markets */}
                        <p className="mt-3 mb-2 text-xs uppercase tracking-wider text-secondary">Withdraw From</p>
                        <div className="space-y-2">
                          {sourceMarkets.map((alloc) => {
                            const cap = flowCapMap.get(alloc.market.uniqueKey);
                            const isIdle = !alloc.market.collateralAsset;
                            const label = isIdle ? 'Idle Market' : (alloc.market.collateralAsset?.symbol ?? 'Unknown');
                            const vaultSupply = BigInt(alloc.supplyAssets);
                            const liquidity = BigInt(alloc.market.state.liquidityAssets);
                            const maxOut = cap?.maxOut ?? 0n;

                            return (
                              <div
                                key={alloc.market.uniqueKey}
                                className="rounded border border-border bg-surface-soft p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {alloc.market.collateralAsset && (
                                      <TokenIcon
                                        address={alloc.market.collateralAsset.address}
                                        chainId={market.morphoBlue.chain.id}
                                        symbol={alloc.market.collateralAsset.symbol}
                                        width={20}
                                        height={20}
                                      />
                                    )}
                                    <span className="text-sm font-medium">{label}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSetMaxForMarket(alloc)}
                                    className="text-xs text-blue-500 hover:text-blue-400"
                                  >
                                    MAX
                                  </button>
                                </div>

                                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-secondary">
                                  <div>
                                    <span className="block">Vault Supply</span>
                                    <span className="tabular-nums text-primary">{formatUnits(vaultSupply, market.loanAsset.decimals)}</span>
                                  </div>
                                  <div>
                                    <span className="block">Liquidity</span>
                                    <span className="tabular-nums text-primary">{formatUnits(liquidity, market.loanAsset.decimals)}</span>
                                  </div>
                                  <div>
                                    <span className="block">Max Outflow</span>
                                    <span className="tabular-nums text-primary">
                                      {isFlowCapsLoading ? <Spinner size={12} /> : formatUnits(maxOut, market.loanAsset.decimals)}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0.0"
                                    value={withdrawAmounts[alloc.market.uniqueKey] ?? ''}
                                    onChange={(e) =>
                                      setWithdrawAmounts((prev) => ({
                                        ...prev,
                                        [alloc.market.uniqueKey]: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded border border-border bg-surface px-3 py-1.5 text-sm tabular-nums text-primary outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary */}
                        <div className="mt-4 space-y-2 rounded border border-border bg-surface-soft p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-secondary">Total Withdrawal</span>
                            <span className="tabular-nums">
                              {formatUnits(totalWithdrawal, market.loanAsset.decimals)} {market.loanAsset.symbol}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-secondary">Fee</span>
                            <span className="tabular-nums">{isFeeLoading ? <Spinner size={12} /> : `${formatUnits(fee, 18)} ETH`}</span>
                          </div>
                        </div>

                        {/* Validation error */}
                        {validationError && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{validationError}</p>}

                        {/* Execute button */}
                        <Button
                          className="mt-4 w-full"
                          onClick={handleReallocate}
                          disabled={!!validationError || isConfirming || isFlowCapsLoading || isFeeLoading}
                        >
                          {isConfirming ? (
                            <span className="flex items-center gap-2">
                              <Spinner size={16} /> Reallocating...
                            </span>
                          ) : (
                            'Reallocate'
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </>
            )
          ) : (
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-300">
              Public Allocator is not available on this network.
            </div>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
