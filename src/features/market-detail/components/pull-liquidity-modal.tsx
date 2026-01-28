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
import { usePublicAllocatorVaults, type ProcessedPublicAllocatorVault, type FlowCapsByMarket } from '@/hooks/usePublicAllocatorVaults';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import type { VaultAllocation } from '@/data-sources/morpho-api/vault-allocations';
import type { Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type PullLiquidityModalProps = {
  market: Market;
  network: SupportedNetworks;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

/**
 * Modal for pulling liquidity into a market via the Public Allocator.
 *
 * Improvements over the old ReallocateModal:
 * - Fetches ALL vault data upfront in a single batch query
 * - Only shows vaults with Public Allocator enabled
 * - Shows vault names instead of truncated addresses
 * - Flow caps come from API instead of on-chain reads
 * - Focused UX: "pull liquidity" into THIS market
 */
export function PullLiquidityModal({ market, network, onOpenChange, onSuccess }: PullLiquidityModalProps) {
  const [selectedVaultAddress, setSelectedVaultAddress] = useState<string | null>(null);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});

  const supplyingVaults = market.supplyingVaults ?? [];
  const supplyingVaultAddresses = useMemo(() => supplyingVaults.map((v) => v.address), [supplyingVaults]);
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[network];
  const isNetworkSupported = !!allocatorAddress;
  const chainId = market.morphoBlue.chain.id;
  const decimals = market.loanAsset.decimals;
  const symbol = market.loanAsset.symbol;

  // Batch-fetch all PA-enabled vaults upfront
  const {
    vaults: paVaults,
    isLoading: isVaultsLoading,
    error: vaultsError,
  } = usePublicAllocatorVaults(supplyingVaultAddresses, network);

  // Selected vault data
  const selectedVault = useMemo(
    () => paVaults.find((v) => v.address === selectedVaultAddress) ?? null,
    [paVaults, selectedVaultAddress],
  );

  // Source markets: vault's other markets (excluding the current target market)
  const sourceMarkets = useMemo(() => {
    if (!selectedVault?.state?.allocation) return [];
    return selectedVault.state.allocation.filter((alloc) => alloc.market.uniqueKey !== market.uniqueKey);
  }, [selectedVault, market.uniqueKey]);

  // Flow cap map for the selected vault
  const flowCapMap: FlowCapsByMarket = useMemo(() => {
    return selectedVault?.flowCapsByMarket ?? new Map();
  }, [selectedVault]);

  // Target market flow cap (maxIn)
  const targetFlowCap = flowCapMap.get(market.uniqueKey);

  // Public Allocator transaction hook
  const { pullLiquidity, isConfirming } = usePublicAllocator({
    vaultAddress: selectedVaultAddress as Address | undefined,
    chainId: network,
    fee: selectedVault?.feeBigInt,
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
    },
  });

  // Reset amounts when vault changes
  const handleVaultSelect = useCallback(
    (address: string) => {
      setSelectedVaultAddress(address);
      setWithdrawAmounts({});
    },
    [],
  );

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
  const handlePullLiquidity = useCallback(async () => {
    if (!market.collateralAsset) return;

    const sources: {
      marketParams: { loanToken: Address; collateralToken: Address; oracle: Address; irm: Address; lltv: bigint };
      amount: bigint;
      sortKey: string;
    }[] = [];

    for (const alloc of sourceMarkets) {
      const parsed = parseAmount(withdrawAmounts[alloc.market.uniqueKey]);
      if (parsed <= 0n) continue;

      sources.push({
        marketParams: {
          loanToken: alloc.market.loanAsset.address as Address,
          collateralToken: (alloc.market.collateralAsset?.address ?? '0x0000000000000000000000000000000000000000') as Address,
          oracle: alloc.market.oracle.address as Address,
          irm: alloc.market.irmAddress as Address,
          lltv: BigInt(alloc.market.lltv),
        },
        amount: parsed,
        sortKey: alloc.market.uniqueKey,
      });
    }

    const targetMarketParams = {
      loanToken: market.loanAsset.address as Address,
      collateralToken: market.collateralAsset.address as Address,
      oracle: market.oracleAddress as Address,
      irm: market.irmAddress as Address,
      lltv: BigInt(market.lltv),
    };

    await pullLiquidity(sources, targetMarketParams);
  }, [sourceMarkets, withdrawAmounts, market, pullLiquidity, parseAmount]);

  /**
   * Calculate total pullable liquidity from a vault's other markets
   * (excluding the target market).
   */
  const getVaultPullableLiquidity = useCallback(
    (vault: ProcessedPublicAllocatorVault): bigint => {
      let total = 0n;
      for (const alloc of vault.state.allocation) {
        if (alloc.market.uniqueKey === market.uniqueKey) continue;

        const cap = vault.flowCapsByMarket.get(alloc.market.uniqueKey);
        const maxOut = cap?.maxOut ?? 0n;
        const vaultSupply = BigInt(alloc.supplyAssets);
        const liquidity = BigInt(alloc.market.state.liquidityAssets);

        let maxAmount = maxOut;
        if (vaultSupply < maxAmount) maxAmount = vaultSupply;
        if (liquidity < maxAmount) maxAmount = liquidity;
        total += maxAmount;
      }
      return total;
    },
    [market.uniqueKey],
  );

  const isReady = !!selectedVault && sourceMarkets.length > 0;
  const canExecute = isReady && !validationError && !isConfirming;

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="2xl"
      title="Pull Liquidity"
    >
      <ModalHeader
        title="Pull Liquidity"
        description={`Pull liquidity into the ${symbol}/${market.collateralAsset?.symbol ?? 'idle'} market from other markets within a vault`}
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
          ) : paVaults.length === 0 ? (
            <div className="rounded border border-border bg-surface-soft p-4 text-center text-sm text-secondary">
              {supplyingVaults.length === 0
                ? 'No MetaMorpho vaults supply to this market.'
                : 'No supplying vaults have the Public Allocator enabled.'}
            </div>
          ) : (
            <>
              {/* Step 1: Vault Selection */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-secondary">Select Vault</p>
                <div className="space-y-1">
                  {paVaults.map((vault) => {
                    const isSelected = selectedVaultAddress === vault.address;
                    const pullable = getVaultPullableLiquidity(vault);
                    const hasPullable = pullable > 0n;

                    return (
                      <button
                        type="button"
                        key={vault.address}
                        onClick={() => handleVaultSelect(vault.address)}
                        disabled={!hasPullable}
                        className={`flex w-full items-center justify-between rounded border px-3 py-2.5 text-left text-sm transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-400/10'
                            : hasPullable
                              ? 'border-border bg-surface-soft hover:bg-surface-dark'
                              : 'cursor-not-allowed border-border bg-surface-soft opacity-50'
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
                        <div className="text-right">
                          <span className="tabular-nums text-xs text-secondary">
                            {hasPullable
                              ? `${Number(formatUnits(pullable, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol} available`
                              : 'No liquidity'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Source Markets */}
              {selectedVault &&
                (sourceMarkets.length === 0 ? (
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
                          {market.collateralAsset && (
                            <TokenIcon
                              address={market.collateralAsset.address}
                              chainId={chainId}
                              symbol={market.collateralAsset.symbol}
                              width={16}
                              height={16}
                            />
                          )}
                          <span className="text-sm">
                            {symbol}/{market.collateralAsset?.symbol ?? 'idle'}
                          </span>
                          {targetFlowCap && (
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
                        <span className="text-secondary">Total Pull Amount</span>
                        <span className="tabular-nums">
                          {formatUnits(totalWithdrawal, decimals)} {symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary">Fee</span>
                        <span className="tabular-nums">
                          {formatUnits(selectedVault.feeBigInt, 18)} ETH
                        </span>
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

/* ─── Source Market Row ─── */

type SourceMarketRowProps = {
  alloc: VaultAllocation;
  chainId: number;
  decimals: number;
  symbol: string;
  flowCap: { maxIn: bigint; maxOut: bigint } | undefined;
  value: string;
  onChange: (val: string) => void;
  onMax: () => void;
};

function SourceMarketRow({ alloc, chainId, decimals, symbol, flowCap, value, onChange, onMax }: SourceMarketRowProps) {
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
          <span className="tabular-nums text-primary">{formatUnits(maxOut, decimals)}</span>
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
          onKeyDown={(e) => {
            if (e.key === '-' || e.key === 'e') e.preventDefault();
          }}
          className="w-full rounded border border-border bg-surface px-3 py-1.5 text-sm tabular-nums text-primary outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
