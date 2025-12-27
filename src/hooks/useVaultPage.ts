import { useCallback, useMemo } from 'react';
import { type Address, formatUnits, zeroAddress } from 'viem';
import type { SupportedNetworks } from '@/utils/networks';
import { useMorphoMarketV1Adapters } from './useMorphoMarketV1Adapters';
import useUserPositionsSummaryData from './useUserPositionsSummaryData';
import { useVaultAllocations } from './useVaultAllocations';
import { useVaultV2 } from './useVaultV2';
import { useVaultV2Data } from './useVaultV2Data';

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
  const adapterQuery = useMorphoMarketV1Adapters({ vaultAddress, chainId });
  const allocationsQuery = useVaultAllocations({ vaultAddress, chainId });

  // Complex derived state: isVaultInitialized (needs multiple sources)
  const isVaultInitialized = useMemo(() => {
    if (adapterQuery.isLoading || vaultDataQuery.isLoading) return false;
    if (adapterQuery.morphoMarketV1Adapter === zeroAddress) return false;
    return vaultDataQuery.data !== null && vaultDataQuery.data !== undefined;
  }, [adapterQuery.isLoading, adapterQuery.morphoMarketV1Adapter, vaultDataQuery.isLoading, vaultDataQuery.data]);

  const needsAdapterDeployment = useMemo(
    () => !adapterQuery.isLoading && adapterQuery.morphoMarketV1Adapter === zeroAddress,
    [adapterQuery.isLoading, adapterQuery.morphoMarketV1Adapter],
  );

  // Fetch adapter positions for APY calculation
  const { positions: adapterPositions, isEarningsLoading: isAPYLoading } = useUserPositionsSummaryData(
    !needsAdapterDeployment && adapterQuery.morphoMarketV1Adapter !== zeroAddress ? adapterQuery.morphoMarketV1Adapter : undefined,
    'day',
    [chainId],
  );

  // Expensive computation: vaultAPY (weighted average across positions)
  const vaultAPY = useMemo(() => {
    if (!adapterPositions || adapterPositions.length === 0) return null;

    let totalSuppliedNorm = 0;
    let weightedAPY = 0;

    for (const position of adapterPositions) {
      const suppliedNorm = Number(formatUnits(BigInt(position.state.supplyAssets), position.market.loanAsset.decimals));
      if (suppliedNorm <= 0) continue;

      const apy = position.market.state.supplyApy ?? 0;
      totalSuppliedNorm += suppliedNorm;
      weightedAPY += suppliedNorm * apy;
    }

    if (totalSuppliedNorm === 0) return null;
    return weightedAPY / totalSuppliedNorm;
  }, [adapterPositions]);

  // Calculate total 24h earnings
  const vault24hEarnings = useMemo(() => {
    if (!adapterPositions || adapterPositions.length === 0) return null;

    let total = 0n;
    adapterPositions.forEach((position) => {
      if (position.earned) {
        total += BigInt(position.earned);
      }
    });

    return total;
  }, [adapterPositions]);

  // Complex derived state: needsInitialization
  const needsInitialization = useMemo(() => {
    const isLoading = vaultDataQuery.isLoading || contract.isLoading || adapterQuery.isLoading;
    if (isLoading) return false;
    if (isVaultInitialized) return false;
    return true;
  }, [vaultDataQuery.isLoading, contract.isLoading, adapterQuery.isLoading, isVaultInitialized]);

  // Aggregated refetch function (convenience)
  const refetchAll = useCallback(() => {
    void vaultDataQuery.refetch();
    void contract.refetch();
    void adapterQuery.refetch();
    void allocationsQuery.refetch();
  }, [vaultDataQuery, contract, adapterQuery, allocationsQuery]);

  // Return ONLY computed/derived state - no raw data!
  return {
    // Complex computed state
    isVaultInitialized,
    needsAdapterDeployment,
    needsInitialization,
    vaultAPY,
    vault24hEarnings,
    isAPYLoading,

    // Aggregated utilities
    refetchAll,
  };
}
