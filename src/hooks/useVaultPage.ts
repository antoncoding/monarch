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
    owner: contractOwner,
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

  // Compute initialization state
  // A vault goes through these states:
  // 1. Vault deployed (has address)
  // 2. Adapter deployed (morphoMarketV1Adapter !== zeroAddress)
  // 3. Vault initialized (adapter registered + registry set) - API returns data
  // 4. Fully configured (adapter cap + collateral caps + market caps set)
  //
  // The Morpho API returns data once the vault is initialized (state 3+).
  // Caps can be configured separately after initialization.
  const isVaultInitialized = useMemo(() => {
    // Still loading - can't determine state yet
    if (adapterLoading || vaultDataLoading) {
      return false;
    }

    // If adapter not deployed, definitely not initialized
    if (morphoMarketV1Adapter === zeroAddress) {
      return false;
    }

    // If adapter exists and we have vault data from API, the vault is initialized
    // (Morpho API only returns data for initialized vaults that have been registered)
    // Note: Caps may or may not be set at this point - that's a separate configuration step
    return vaultData !== null && vaultData !== undefined;
  }, [adapterLoading, vaultDataLoading, morphoMarketV1Adapter, vaultData]);

  // Helper flag: adapter not deployed at all (need to deploy it first)
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

  // Determine ownership from contract owner (not API data, since API returns null for uninitialized vaults)
  const isOwner = useMemo(
    () => Boolean(contractOwner && connectedAddress && contractOwner.toLowerCase() === connectedAddress.toLowerCase()),
    [contractOwner, connectedAddress],
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

  // Loading states - wait for ALL queries before showing content
  const isLoading = vaultDataLoading || contractLoading || adapterLoading || allocationsLoading;
  const hasError = !!vaultDataError || !!allocationsError;

  // Comprehensive check: needs initialization if vault is deployed but not fully initialized
  // This captures the state where:
  // - Vault contract is deployed
  // - Adapter may or may not be deployed
  // - But the vault hasn't been initialized (registry not set, adapter not registered, caps not set)
  const needsInitialization = useMemo(() => {
    // Don't show initialization prompt while still loading
    if (isLoading) {
      return false;
    }

    // If vault is already initialized, no need for initialization
    if (isVaultInitialized) {
      return false;
    }

    // At this point: vault exists but is not initialized
    // This covers both cases:
    // 1. Adapter not deployed yet (need to deploy + initialize)
    // 2. Adapter deployed but not connected to vault (need to initialize)
    return true;
  }, [isLoading, isVaultInitialized]);

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
    needsInitialization,
    isVaultInitialized,
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
