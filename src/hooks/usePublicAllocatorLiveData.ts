import { useMemo } from 'react';
import type { Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { publicAllocatorAbi } from '@/abis/public-allocator';
import morphoABI from '@/abis/morpho';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import { getMorphoAddress } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';

// ── Types ──

export type LiveMarketData = {
  /** Maximum assets that can flow into this market via the public allocator */
  maxIn: bigint;
  /** Maximum assets that can flow out of this market via the public allocator */
  maxOut: bigint;
  /** The vault's supply in this market, converted from shares to assets */
  vaultSupplyAssets: bigint;
  /** Total available liquidity in the market (totalSupply - totalBorrow) */
  marketLiquidity: bigint;
};

export type UsePublicAllocatorLiveDataResult = {
  /** Map of marketId → live on-chain data. Null when not yet loaded or disabled. */
  liveData: Map<string, LiveMarketData> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Batch-reads on-chain data for a selected vault's markets via RPC.
 *
 * For each market ID, reads:
 * 1. `publicAllocator.flowCaps(vault, marketId)` → maxIn, maxOut
 * 2. `morpho.position(marketId, vault)` → supplyShares (to convert to assets)
 * 3. `morpho.market(marketId)` → totalSupplyAssets/Shares, totalBorrowAssets (for share→asset conversion & liquidity)
 *
 * This provides real-time verification of values that may lag in the API indexer,
 * especially flow caps which change with every reallocation.
 *
 * @param vaultAddress - The MetaMorpho vault address
 * @param chainId - The network to query
 * @param marketIds - Array of market uniqueKeys (bytes32) in the vault's allocation
 * @param enabled - Only fetch when true (e.g., when a vault is selected)
 */
export function usePublicAllocatorLiveData(
  vaultAddress: Address | undefined,
  chainId: SupportedNetworks,
  marketIds: string[],
  enabled: boolean,
): UsePublicAllocatorLiveDataResult {
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[chainId];
  const morphoAddress = getMorphoAddress(chainId) as Address;

  // Build the batch of contract read calls: 3 calls per market
  const contracts = useMemo(() => {
    if (!vaultAddress || !allocatorAddress || marketIds.length === 0) return [];

    return marketIds.flatMap((marketId) => [
      // 1. flowCaps(vault, marketId) → (maxIn, maxOut)
      {
        address: allocatorAddress,
        abi: publicAllocatorAbi,
        functionName: 'flowCaps' as const,
        args: [vaultAddress, marketId as `0x${string}`] as const,
        chainId,
      },
      // 2. position(marketId, vault) → (supplyShares, borrowShares, collateral)
      {
        address: morphoAddress,
        abi: morphoABI,
        functionName: 'position' as const,
        args: [marketId as `0x${string}`, vaultAddress] as const,
        chainId,
      },
      // 3. market(marketId) → (totalSupplyAssets, totalSupplyShares, totalBorrowAssets, ...)
      {
        address: morphoAddress,
        abi: morphoABI,
        functionName: 'market' as const,
        args: [marketId as `0x${string}`] as const,
        chainId,
      },
    ]);
  }, [vaultAddress, allocatorAddress, morphoAddress, marketIds, chainId]);

  const isEnabled = enabled && !!vaultAddress && !!allocatorAddress && marketIds.length > 0 && contracts.length > 0;

  const {
    data: rawResults,
    isLoading,
    error,
    refetch,
  } = useReadContracts({
    contracts,
    query: {
      enabled: isEnabled,
      staleTime: 10_000, // 10s — fresh data without spamming
    },
  });

  // Process raw multicall results into a structured map
  const liveData = useMemo(() => {
    if (!rawResults || rawResults.length === 0 || !isEnabled) return null;

    const map = new Map<string, LiveMarketData>();

    for (let i = 0; i < marketIds.length; i++) {
      const baseIdx = i * 3;
      const flowCapsResult = rawResults[baseIdx];
      const positionResult = rawResults[baseIdx + 1];
      const marketResult = rawResults[baseIdx + 2];

      // Skip if any call failed
      if (flowCapsResult?.status !== 'success' || positionResult?.status !== 'success' || marketResult?.status !== 'success') {
        continue;
      }

      // flowCaps returns [maxIn, maxOut]
      const flowCaps = flowCapsResult.result as [bigint, bigint];
      const maxIn = flowCaps[0];
      const maxOut = flowCaps[1];

      // position returns [supplyShares, borrowShares, collateral]
      const position = positionResult.result as [bigint, bigint, bigint];
      const supplyShares = position[0];

      // market returns [totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee]
      const marketData = marketResult.result as [bigint, bigint, bigint, bigint, bigint, bigint];
      const totalSupplyAssets = marketData[0];
      const totalSupplyShares = marketData[1];
      const totalBorrowAssets = marketData[2];

      // Convert supply shares to assets
      const vaultSupplyAssets = totalSupplyShares > 0n ? (supplyShares * totalSupplyAssets) / totalSupplyShares : 0n;

      // Market liquidity = total supply - total borrow
      const marketLiquidity = totalSupplyAssets - totalBorrowAssets;

      map.set(marketIds[i], {
        maxIn,
        maxOut,
        vaultSupplyAssets,
        marketLiquidity: marketLiquidity > 0n ? marketLiquidity : 0n,
      });
    }

    return map.size > 0 ? map : null;
  }, [rawResults, marketIds, isEnabled]);

  return {
    liveData,
    isLoading: isEnabled && isLoading,
    error: error as Error | null,
    refetch,
  };
}
