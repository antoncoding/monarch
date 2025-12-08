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
 * Unified hook for vault page data and actions.
 * Combines all vault-related data fetching and provides computed state.
 */
export function useVaultPage({ vaultAddress, chainId, connectedAddress }: UseVaultPageArgs) {
  // Fetch vault data from API/subgraph
  const {
    data: vaultData,
    loading: vaultDataLoading,
    error: vaultDataError,
    refetch: refetchVaultData,
  } = useVaultV2Data({
    vaultAddress,
    chainId,
  });

  // Memoize transaction success handler to prevent infinite refetch loops
  const handleTransactionSuccess = useCallback(() => {
    void refetchVaultData();
  }, [refetchVaultData]);

  // Fetch vault contract state and actions
  const {
    isLoading: contractLoading,
    refetch: refetchContract,
    updateNameAndSymbol,
    isUpdatingMetadata,
    name: onChainName,
    symbol: onChainSymbol,
    setAllocator,
    isUpdatingAllocator,
    updateCaps,
    isUpdatingCaps,
    totalAssets,
  } = useVaultV2({
    vaultAddress,
    chainId,
    onTransactionSuccess: handleTransactionSuccess,
  });

  // Fetch market adapter
  const { morphoMarketV1Adapter, loading: adapterLoading, refetch: refetchAdapter } = useMorphoMarketV1Adapters({ vaultAddress, chainId });

  // Compute derived state
  const needsAdapterDeployment = useMemo(
    () => !adapterLoading && morphoMarketV1Adapter === zeroAddress,
    [adapterLoading, morphoMarketV1Adapter],
  );

  // Fetch adapter positions for APY calculation (only last 24h, only current chain)
  const { positions: adapterPositions, isEarningsLoading: isAPYLoading } = useUserPositionsSummaryData(
    !needsAdapterDeployment && morphoMarketV1Adapter !== zeroAddress ? morphoMarketV1Adapter : undefined,
    'day',
    [chainId],
  );

  // Calculate vault APY from adapter positions (weighted average)
  // Uses normalized decimals to avoid precision loss from BigInt->Number conversion
  const vaultAPY = useMemo(() => {
    if (!adapterPositions || adapterPositions.length === 0) return null;

    let totalSuppliedNorm = 0;
    let weightedAPY = 0;

    for (const position of adapterPositions) {
      // Normalize to human-readable decimals to avoid overflow/precision loss
      const suppliedNorm = Number(formatUnits(BigInt(position.state.supplyAssets), position.market.loanAsset.decimals));
      if (suppliedNorm <= 0) continue;

      const apy = position.market.state.supplyApy ?? 0;
      totalSuppliedNorm += suppliedNorm;
      weightedAPY += suppliedNorm * apy;
    }

    if (totalSuppliedNorm === 0) return null;
    return weightedAPY / totalSuppliedNorm;
  }, [adapterPositions]);

  // Calculate total 24h earnings from adapter positions
  const vault24hEarnings = useMemo(() => {
    if (!adapterPositions || adapterPositions.length === 0) return null;

    let total = 0n;

    adapterPositions.forEach((position) => {
      if (position.earned) {
        // Sum up all earnings (assumes they're in raw bigint string format)
        total += BigInt(position.earned);
      }
    });

    return total;
  }, [adapterPositions]);

  const isOwner = useMemo(
    () => Boolean(vaultData?.owner && connectedAddress && vaultData.owner.toLowerCase() === connectedAddress.toLowerCase()),
    [vaultData?.owner, connectedAddress],
  );

  const hasNoAllocators = useMemo(
    () => !needsAdapterDeployment && (vaultData?.allocators ?? []).length === 0,
    [needsAdapterDeployment, vaultData?.allocators],
  );

  const capsUninitialized = useMemo(() => vaultData?.capsData?.needSetupCaps ?? true, [vaultData?.capsData?.needSetupCaps]);

  // Fetch and parse allocations with typed structures
  const {
    collateralAllocations,
    marketAllocations,
    loading: allocationsLoading,
    error: allocationsError,
    refetch: refetchAllocations,
  } = useVaultAllocations({
    collateralCaps: vaultData?.capsData?.collateralCaps ?? [],
    marketCaps: vaultData?.capsData?.marketCaps ?? [],
    vaultAddress,
    chainId,
    enabled: !needsAdapterDeployment && !!vaultData?.capsData,
  });

  // Unified refetch function
  const refetchAll = useCallback(() => {
    void refetchVaultData();
    void refetchContract();
    void refetchAdapter();
    void refetchAllocations();
  }, [refetchVaultData, refetchContract, refetchAdapter, refetchAllocations]);

  // Loading states
  const isLoading = vaultDataLoading || contractLoading || adapterLoading;
  const hasError = !!vaultDataError || !!allocationsError;

  return {
    // Data
    vaultData,
    totalAssets,
    collateralAllocations,
    marketAllocations,
    adapter: morphoMarketV1Adapter,
    onChainName,
    onChainSymbol,

    // APY & Earnings
    vaultAPY,
    vault24hEarnings,
    isAPYLoading,

    // Computed state
    isOwner,
    needsAdapterDeployment,
    hasNoAllocators,
    capsUninitialized,

    // Loading/Error states
    isLoading,
    vaultDataLoading,
    allocationsLoading,
    adapterLoading,
    hasError,

    // Actions
    updateNameAndSymbol,
    setAllocator,
    updateCaps,
    refetchAll,
    refetchAdapter,

    // Action loading states
    isUpdatingMetadata,
    isUpdatingAllocator,
    isUpdatingCaps,
  };
}
