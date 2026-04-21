import { useMemo, useCallback } from 'react';
import { type Address, zeroAddress } from 'viem';
import { usePublicAllocatorVaults } from '@/hooks/usePublicAllocatorVaults';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import {
  getVaultPullableAmount,
  autoAllocateWithdrawals,
  resolveWithdrawals,
  buildBundlerReallocateCalldata,
  type PAMarketParams,
} from '@/utils/public-allocator';
import type { Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

// ── Types ──

export type ReallocationPlan = {
  /** The vault to reallocate from */
  vaultAddress: Address;
  /** Vault name for display */
  vaultName: string;
  /** Fee in wei to pay for the reallocation */
  fee: bigint;
  /** Bundler-compatible calldata (for borrow multicall) */
  bundlerCalldata: `0x${string}`;
  /** Resolved withdrawals with marketParams, amounts, and sort keys */
  withdrawals: { marketParams: PAMarketParams; amount: bigint; sortKey: string }[];
  /** Target market params */
  targetMarketParams: PAMarketParams;
};

export type LiquiditySourcingResult = {
  /** Maximum extra liquidity executable by the current one-vault PA reallocation flow */
  totalAvailableExtraLiquidity: bigint;
  /** Whether any PA vaults can source liquidity for this market */
  canSourceLiquidity: boolean;
  /** Loading state */
  isLoading: boolean;
  /**
   * For a given amount of extra liquidity needed, compute the reallocation plan.
   * Returns null if the amount can't be sourced.
   */
  computeReallocation: (extraAmountNeeded: bigint) => ReallocationPlan | null;
  /** Refetch PA data */
  refetch: () => void;
};

/**
 * Pre-fetches Public Allocator vault data for a market at the page level.
 *
 * This hook is the "brain" of liquidity sourcing. It eagerly loads PA-enabled
 * vaults and pre-computes max pullable amounts so that modal UI calculations
 * are instant — no lazy loading when user opens a modal.
 *
 * Used by both borrow and withdraw flows:
 * - **Borrow**: prepend `reallocateTo` calldata to bundler multicall (single tx)
 * - **Withdraw**: execute reallocateTo as step 1, then withdraw as step 2
 *
 * @param market - The current market
 * @param network - The network to query
 */
export function useMarketLiquiditySourcing(market: Market | undefined, network: SupportedNetworks): LiquiditySourcingResult {
  const supplyingVaults = market?.supplyingVaults ?? [];
  const supplyingVaultAddresses = useMemo(() => supplyingVaults.map((v) => v.address), [supplyingVaults]);
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[network];
  const isNetworkSupported = !!allocatorAddress;
  const marketKey = market?.uniqueKey ?? '';

  // Batch-fetch all PA-enabled vaults upfront (API data)
  const { vaults: paVaults, isLoading, refetch } = usePublicAllocatorVaults(supplyingVaultAddresses, network);

  // Pre-compute pullable amounts for each vault, sorted by most pullable
  const vaultsWithPullable = useMemo(() => {
    if (!isNetworkSupported || !marketKey) return [];

    return paVaults
      .map((vault) => ({
        vault,
        pullable: getVaultPullableAmount(vault, marketKey),
      }))
      .filter(({ pullable }) => pullable > 0n)
      .sort((a, b) => (b.pullable > a.pullable ? 1 : b.pullable < a.pullable ? -1 : 0));
  }, [paVaults, marketKey, isNetworkSupported]);

  // The current execution path builds one reallocateTo call for one PA vault.
  // Expose the largest single-vault amount, not the sum across vaults that
  // cannot be executed together by the withdraw flow.
  const totalAvailableExtraLiquidity = useMemo(() => vaultsWithPullable[0]?.pullable ?? 0n, [vaultsWithPullable]);

  const canSourceLiquidity = totalAvailableExtraLiquidity > 0n;

  /**
   * Compute a reallocation plan for a given amount of extra liquidity needed.
   *
   * Auto-selects the best vault (most pullable) that can cover the requested amount,
   * uses greedy allocation across source markets, sorts by market ID ascending,
   * and builds bundler-compatible calldata.
   */
  const computeReallocation = useCallback(
    (extraAmountNeeded: bigint): ReallocationPlan | null => {
      if (!market || !allocatorAddress || extraAmountNeeded <= 0n || vaultsWithPullable.length === 0) {
        return null;
      }

      const selectedEntry = vaultsWithPullable.find((entry) => entry.pullable >= extraAmountNeeded);
      if (!selectedEntry) return null;

      const { vault } = selectedEntry;

      // Auto-allocate withdrawals using the greedy algorithm
      const allocated = autoAllocateWithdrawals(vault, marketKey, extraAmountNeeded);
      if (allocated.length === 0) return null;
      const allocatedAmount = allocated.reduce((sum, { amount }) => sum + amount, 0n);
      if (allocatedAmount < extraAmountNeeded) return null;

      // Resolve to full withdrawal structs with market params
      const resolvedWithdrawals = resolveWithdrawals(vault, allocated);
      if (resolvedWithdrawals.length === 0) return null;
      const resolvedAmount = resolvedWithdrawals.reduce((sum, { amount }) => sum + amount, 0n);
      if (resolvedAmount < extraAmountNeeded) return null;

      // Build target market params
      const targetMarketParams: PAMarketParams = {
        loanToken: market.loanAsset.address as Address,
        collateralToken: (market.collateralAsset?.address ?? zeroAddress) as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      };

      // Build bundler calldata
      const withdrawalsForCalldata = resolvedWithdrawals.map(({ marketParams, amount }) => ({
        marketParams,
        amount,
      }));

      const bundlerCalldata = buildBundlerReallocateCalldata(
        allocatorAddress,
        vault.address as Address,
        vault.feeBigInt,
        withdrawalsForCalldata,
        targetMarketParams,
      );

      return {
        vaultAddress: vault.address as Address,
        vaultName: vault.name,
        fee: vault.feeBigInt,
        bundlerCalldata,
        withdrawals: resolvedWithdrawals,
        targetMarketParams,
      };
    },
    [market, allocatorAddress, marketKey, vaultsWithPullable],
  );

  return {
    totalAvailableExtraLiquidity,
    canSourceLiquidity,
    isLoading,
    computeReallocation,
    refetch,
  };
}
