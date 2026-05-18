import { useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import type { SupportedNetworks } from '@/utils/networks';
import { useMorphoMarketAdapters } from './useMorphoMarketAdapters';
import { useVaultAllocations } from './useVaultAllocations';
import { useVaultV2 } from './useVaultV2';
import { useVaultV2Data } from './useVaultV2Data';
import { formatBalance } from '@/utils/balance';

type UseVaultPageArgs = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  connectedAddress?: Address;
};

/**
 * Simplified vault page hook - ONLY computes complex derived state.
 * Components should pull raw data themselves using individual hooks.
 *
 * Use this for:
 * - Complex computations requiring multiple data sources
 * - Expensive calculations (APY)
 * - Aggregated refetch functions
 *
 * DON'T use this for:
 * - Raw data (use useVaultV2Data, etc. directly)
 * - Simple 1-liner computations (do in component)
 */
export function useVaultPage({ vaultAddress, chainId, connectedAddress }: UseVaultPageArgs) {
  // Pull only what we need for computations
  const vaultDataQuery = useVaultV2Data({ vaultAddress, chainId });
  const contract = useVaultV2({ vaultAddress, chainId, connectedAddress, onTransactionSuccess: vaultDataQuery.refetch });
  const adapterQuery = useMorphoMarketAdapters({ vaultAddress, chainId });
  const allocationsQuery = useVaultAllocations({ vaultAddress, chainId });
  const { refetch: refetchVaultData } = vaultDataQuery;
  const { refetch: refetchContract } = contract;
  const { refetch: refetchAdapter } = adapterQuery;
  const { refetch: refetchAllocations } = allocationsQuery;
  const hasResolvedAdapterState = !adapterQuery.isLoading && !adapterQuery.error;
  const hasResolvedVaultState = !vaultDataQuery.isLoading && !vaultDataQuery.isError;

  // Complex derived state: isVaultInitialized (needs multiple sources)
  const isVaultInitialized = useMemo(() => {
    if (!hasResolvedAdapterState || !hasResolvedVaultState) return false;
    if (!adapterQuery.primaryAdapter) return false;
    return vaultDataQuery.data !== null && vaultDataQuery.data !== undefined;
  }, [adapterQuery.primaryAdapter, hasResolvedAdapterState, hasResolvedVaultState, vaultDataQuery.data]);

  const needsAdapterDeployment = useMemo(
    () => hasResolvedAdapterState && !adapterQuery.primaryAdapter,
    [adapterQuery.primaryAdapter, hasResolvedAdapterState],
  );

  // Weighted average across configured market allocations. This avoids position
  // discovery and historical RPC reads on the first vault paint.
  const vaultAPY = useMemo(() => {
    if (allocationsQuery.marketAllocations.length === 0) return null;

    const tokenDecimals = vaultDataQuery.data?.tokenDecimals ?? 18;
    let totalAllocated = 0;
    let weightedAPY = 0;

    for (const allocation of allocationsQuery.marketAllocations) {
      if (allocation.allocation <= 0n) continue;

      const allocated = formatBalance(allocation.allocation, tokenDecimals);
      totalAllocated += allocated;
      weightedAPY += allocated * (allocation.market.state.supplyApy ?? 0);
    }

    if (totalAllocated === 0) return null;
    return weightedAPY / totalAllocated;
  }, [allocationsQuery.marketAllocations, vaultDataQuery.data?.tokenDecimals]);

  // Complex derived state: needsInitialization
  const needsInitialization = useMemo(() => {
    const isLoading = vaultDataQuery.isLoading || contract.isLoading || adapterQuery.isLoading;
    if (isLoading) return false;
    if (!hasResolvedAdapterState || !hasResolvedVaultState) return false;
    if (isVaultInitialized) return false;
    return true;
  }, [
    vaultDataQuery.isLoading,
    contract.isLoading,
    adapterQuery.isLoading,
    hasResolvedAdapterState,
    hasResolvedVaultState,
    isVaultInitialized,
  ]);

  // Aggregated refetch function (convenience)
  const refetchAll = useCallback(() => {
    void refetchVaultData();
    void refetchContract();
    void refetchAdapter();
    void refetchAllocations();
  }, [refetchVaultData, refetchContract, refetchAdapter, refetchAllocations]);

  // Return ONLY computed/derived state - no raw data!
  return {
    // Complex computed state
    isVaultInitialized,
    needsAdapterDeployment,
    needsInitialization,
    vaultAPY,
    vault24hEarnings: null,
    isAPYLoading: allocationsQuery.loading,

    // Aggregated utilities
    refetchAll,
  };
}
