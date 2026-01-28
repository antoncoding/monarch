'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { type Address, formatUnits, parseUnits } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { BsArrowRepeat } from 'react-icons/bs';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
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
 *
 * UX Flow:
 * 1. User sees vaults that supply to this market
 * 2. Selects a vault
 * 3. Sees the vault's other markets (source markets to pull FROM)
 * 4. Enters withdrawal amounts per source market (respecting flow caps)
 * 5. Sees ETH fee
 * 6. Executes reallocateTo
 */
export function ReallocateModal({ market, network, onOpenChange, onSuccess }: ReallocateModalProps) {
  const [selectedVaultAddress, setSelectedVaultAddress] = useState<string | null>(null);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});

  const supplyingVaults = market.supplyingVaults ?? [];
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[network];
  const isNetworkSupported = !!allocatorAddress;
  const chainId = market.morphoBlue.chain.id;
  const decimals = market.loanAsset.decimals;
  const symbol = market.loanAsset.symbol;

  // Fetch vault allocation data when a vault is selected
  const {
    data: vaultData,
    isLoading: isVaultLoading,
    error: vaultError,
  } = useQuery<VaultAllocationData | null>({
    queryKey: ['vault-allocation-reallocate', selectedVaultAddress, network],
    queryFn: () => (selectedVaultAddress ? fetchVaultAllocations(selectedVaultAddress, network) : null),
    enabled: !!selectedVaultAddress,
    staleTime: 30_000,
  });

  // Source markets: vault's other markets excluding the current target
  const sourceMarkets = useMemo(() => {
    if (!vaultData?.state?.allocation) return [];
    return vaultData.state.allocation.filter((alloc) => alloc.market.uniqueKey !== market.uniqueKey);
  }, [vaultData, market.uniqueKey]);

  // Collect market IDs for flow cap queries (sources + target)
  const marketIds = useMemo(() => {
    const ids: `0x${string}`[] = sourceMarkets.map((alloc) => alloc.market.uniqueKey as `0x${string}`);
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

  // Flow cap lookup
  const flowCapMap = useMemo(() => {
    const map = new Map<string, { maxIn: bigint; maxOut: bigint }>();
    for (const cap of flowCaps) {
      map.set(cap.marketId, { maxIn: cap.maxIn, maxOut: cap.maxOut });
    }
    return map;
  }, [flowCaps]);

  const targetFlowCap = flowCapMap.get(market.uniqueKey);

  // Reset amounts when vault changes
  useEffect(() => {
    setWithdrawAmounts({});
  }, [selectedVaultAddress]);

  // Parse amount string to bigint
  const parseAmount = useCallback(
    (amountStr: string | undefined): bigint => {
      if (!amountStr || amountStr === '' || amountStr === '0') return 0n;
      try {
        return parseUnits(amountStr, decimals);
      } catch {
        return 0n;
      }
    },
    [decimals],
  );

  // Total withdrawal across all source markets
  const totalWithdrawal = useMemo(() => {
    let total = 0n;
    for (const alloc of sourceMarkets) {
      total += parseAmount(withdrawAmounts[alloc.market.uniqueKey]);
    }
    return total;
  }, [withdrawAmounts, sourceMarkets, parseAmount]);

  // Validation
  const validationError = useMemo(() => {
    if (totalWithdrawal === 0n) return 'Enter withdrawal amounts';

    if (targetFlowCap && totalWithdrawal > targetFlowCap.maxIn) {
      return `Exceeds target market max inflow (${formatUnits(targetFlowCap.maxIn, decimals)} ${symbol})`;
    }

    for (const alloc of sourceMarkets) {
      const parsed = parseAmount(withdrawAmounts[alloc.market.uniqueKey]);
      if (parsed <= 0n) continue;

      const cap = flowCapMap.get(alloc.market.uniqueKey);
      const label = alloc.market.collateralAsset?.symbol ?? 'idle';

      if (cap && parsed > cap.maxOut) {
        return `Exceeds max outflow for ${label} market`;
      }
      if (parsed > BigInt(alloc.supplyAssets)) {
        return `Exceeds vault supply in ${label} market`;
      }
      if (parsed > BigInt(alloc.market.state.liquidityAssets)) {
        return `Exceeds available liquidity in ${label} market`;
      }
    }

    return null;
  }, [totalWithdrawal, targetFlowCap, sourceMarkets, withdrawAmounts, flowCapMap, decimals, symbol, parseAmount]);

  const handleSetMax = useCallback(
    (alloc: VaultAllocation) => {
      const cap = flowCapMap.get(alloc.market.uniqueKey);
      const maxOut = cap?.maxOut ?? 0n;
      const vaultSupply = BigInt(alloc.supplyAssets);
      const liquidity = BigInt(alloc.market.state.liquidityAssets);

      // Take minimum of maxOut, vault supply, liquidity
      let maxAmount = maxOut;
      if (vaultSupply < maxAmount) maxAmount = vaultSupply;
      if (liquidity < maxAmount) maxAmount = liquidity;

      setWithdrawAmounts((prev) => ({
        ...prev,
        [alloc.market.uniqueKey]: formatUnits(maxAmount, decimals),
      }));
    },
    [flowCapMap, decimals],
  );

  // Build sorted withdrawals and execute
  const handleReallocate = useCallback(async () => {
    const withdrawals: {
      marketParams: { loanToken: Address; collateralToken: Address; oracle: Address; irm: Address; lltv: bigint };
      amount: bigint;
      sortKey: string;
    }[] = [];

    for (const alloc of sourceMarkets) {
      const parsed = parseAmount(withdrawAmounts[alloc.market.uniqueKey]);
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
        sortKey: alloc.market.uniqueKey.toLowerCase(),
      });
    }

    // Contract requires withdrawals sorted by market ID (bytes32 ascending)
    withdrawals.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

    const supplyMarketParams = {
      loanToken: market.loanAsset.address as Address,
      collateralToken: market.collateralAsset.address as Address,
      oracle: market.oracleAddress as Address,
      irm: market.irmAddress as Address,
      lltv: BigInt(market.lltv),
    };

    await reallocate(
      withdrawals.map(({ marketParams, amount }) => ({ marketParams, amount })),
      supplyMarketParams,
    );
  }, [sourceMarkets, withdrawAmounts, market, reallocate, parseAmount]);

  const isReady = !!selectedVaultAddress && !isVaultLoading && sourceMarkets.length > 0;
  const canExecute = isReady && !validationError && !isConfirming && !isFlowCapsLoading && !isFeeLoading;

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="2xl"
      title="Reallocate Liquidity"
    >
      <ModalHeader
        title="Reallocate Liquidity"
        description={`Pull liquidity into the ${symbol}/${market.collateralAsset.symbol} market from other markets within a vault`}
        mainIcon={<BsArrowRepeat className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />

      <ModalBody>
        {isNetworkSupported ? (
          supplyingVaults.length === 0 ? (
            <div className="rounded border border-border bg-surface-soft p-4 text-center text-sm text-secondary">
              No MetaMorpho vaults supply to this market.
            </div>
          ) : (
            <>
              {/* Step 1: Vault Selection */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-secondary">Select Vault</p>
                <div className="space-y-1">
                  {supplyingVaults.map((vault) => {
                    const isSelected = selectedVaultAddress === vault.address;
                    return (
                      <button
                        type="button"
                        key={vault.address}
                        onClick={() => setSelectedVaultAddress(vault.address)}
                        className={`flex w-full items-center justify-between rounded border px-3 py-2.5 text-left text-sm transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-400/10'
                            : 'border-border bg-surface-soft hover:bg-surface-dark'
                        }`}
                      >
                        <span className="font-mono text-xs">
                          {vault.address.slice(0, 6)}...{vault.address.slice(-4)}
                        </span>
                        {isSelected && vaultData && <span className="text-xs text-secondary">{vaultData.name}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Source Markets */}
              {selectedVaultAddress &&
                (isVaultLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <Spinner size={20} />
                    <span className="text-sm text-secondary">Loading vault data...</span>
                  </div>
                ) : vaultError ? (
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
                    Failed to load vault data.
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
                        <span className="text-xs uppercase tracking-wider text-secondary">Target Market</span>
                        <div className="flex items-center gap-2">
                          <TokenIcon
                            address={market.collateralAsset.address}
                            chainId={chainId}
                            symbol={market.collateralAsset.symbol}
                            width={16}
                            height={16}
                          />
                          <span className="text-sm">
                            {symbol}/{market.collateralAsset.symbol}
                          </span>
                          {targetFlowCap && !isFlowCapsLoading && (
                            <span className="text-xs text-secondary">
                              (max inflow: {formatUnits(targetFlowCap.maxIn, decimals)} {symbol})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Source markets list */}
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wider text-secondary">Withdraw From</p>
                      <div className="space-y-2">
                        {sourceMarkets.map((alloc) => (
                          <SourceMarketRow
                            key={alloc.market.uniqueKey}
                            alloc={alloc}
                            chainId={chainId}
                            decimals={decimals}
                            symbol={symbol}
                            flowCap={flowCapMap.get(alloc.market.uniqueKey)}
                            isFlowCapsLoading={isFlowCapsLoading}
                            value={withdrawAmounts[alloc.market.uniqueKey] ?? ''}
                            onChange={(val) =>
                              setWithdrawAmounts((prev) => ({
                                ...prev,
                                [alloc.market.uniqueKey]: val,
                              }))
                            }
                            onMax={() => handleSetMax(alloc)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="space-y-2 rounded border border-border bg-surface-soft p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary">Total Withdrawal</span>
                        <span className="tabular-nums">
                          {formatUnits(totalWithdrawal, decimals)} {symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary">Fee</span>
                        <span className="tabular-nums">{isFeeLoading ? <Spinner size={12} /> : `${formatUnits(fee, 18)} ETH`}</span>
                      </div>
                    </div>

                    {/* Validation error */}
                    {validationError && totalWithdrawal > 0n && <p className="text-xs text-red-500 dark:text-red-400">{validationError}</p>}
                  </>
                ))}
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
        {isNetworkSupported && isReady && (
          <ExecuteTransactionButton
            targetChainId={chainId}
            onClick={() => void handleReallocate()}
            disabled={!canExecute}
            isLoading={isConfirming}
            variant="primary"
          >
            {isConfirming ? 'Reallocating...' : 'Reallocate'}
          </ExecuteTransactionButton>
        )}
      </ModalFooter>
    </Modal>
  );
}

/* ─── Source Market Row ─── */

type SourceMarketRowProps = {
  alloc: VaultAllocation;
  chainId: number;
  decimals: number;
  symbol: string;
  flowCap: { maxIn: bigint; maxOut: bigint } | undefined;
  isFlowCapsLoading: boolean;
  value: string;
  onChange: (val: string) => void;
  onMax: () => void;
};

function SourceMarketRow({ alloc, chainId, decimals, symbol, flowCap, isFlowCapsLoading, value, onChange, onMax }: SourceMarketRowProps) {
  const isIdle = !alloc.market.collateralAsset;
  const label = isIdle ? 'Idle Market' : (alloc.market.collateralAsset?.symbol ?? 'Unknown');
  const vaultSupply = BigInt(alloc.supplyAssets);
  const liquidity = BigInt(alloc.market.state.liquidityAssets);
  const maxOut = flowCap?.maxOut ?? 0n;

  return (
    <div className="rounded border border-border bg-surface-soft p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {alloc.market.collateralAsset && (
            <TokenIcon
              address={alloc.market.collateralAsset.address}
              chainId={chainId}
              symbol={alloc.market.collateralAsset.symbol}
              width={20}
              height={20}
            />
          )}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-secondary">/ {symbol}</span>
        </div>
        <button
          type="button"
          onClick={onMax}
          className="text-xs font-medium text-blue-500 hover:text-blue-400"
        >
          MAX
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-secondary">
        <div>
          <span className="block">Vault Supply</span>
          <span className="tabular-nums text-primary">{formatUnits(vaultSupply, decimals)}</span>
        </div>
        <div>
          <span className="block">Liquidity</span>
          <span className="tabular-nums text-primary">{formatUnits(liquidity, decimals)}</span>
        </div>
        <div>
          <span className="block">Max Outflow</span>
          <span className="tabular-nums text-primary">{isFlowCapsLoading ? <Spinner size={12} /> : formatUnits(maxOut, decimals)}</span>
        </div>
      </div>

      <div className="mt-2">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="0.0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-border bg-surface px-3 py-1.5 text-sm tabular-nums text-primary outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
