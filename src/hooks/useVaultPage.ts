import { useCallback, useMemo } from 'react';
import { Address, zeroAddress } from 'viem';
import { SupportedNetworks } from '@/utils/networks';
import { useVaultV2Data } from './useVaultV2Data';
import { useVaultV2 } from './useVaultV2';
import { useMorphoMarketV1Adapters } from './useMorphoMarketV1Adapters';
import { useAllocations } from './useAllocations';

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
    onTransactionSuccess: refetchVaultData,
  });

  // Fetch market adapter
  const {
    morphoMarketV1Adapter,
    loading: adapterLoading,
    refetch: refetchAdapter,
  } = useMorphoMarketV1Adapters({ vaultAddress, chainId });

  // Compute derived state
  const needsAdapterDeployment = useMemo(
    () => !adapterLoading && morphoMarketV1Adapter === zeroAddress,
    [adapterLoading, morphoMarketV1Adapter],
  );

  const isOwner = useMemo(
    () =>
      Boolean(
        vaultData?.owner && connectedAddress && vaultData.owner.toLowerCase() === connectedAddress.toLowerCase(),
      ),
    [vaultData?.owner, connectedAddress],
  );

  const hasNoAllocators = useMemo(
    () => !needsAdapterDeployment && (vaultData?.allocators ?? []).length === 0,
    [needsAdapterDeployment, vaultData?.allocators],
  );

  const capsUninitialized = useMemo(
    () => vaultData?.capsData?.needSetupCaps ?? true,
    [vaultData?.capsData?.needSetupCaps],
  );

  // Memoize caps array to prevent unnecessary refetches
  const allCaps = useMemo(() => {
    const collateralCaps = vaultData?.capsData?.collateralCaps ?? [];
    const marketCaps = vaultData?.capsData?.marketCaps ?? [];
    return [...collateralCaps, ...marketCaps];
  }, [vaultData?.capsData?.collateralCaps, vaultData?.capsData?.marketCaps]);

  // Fetch current allocations
  const { allocations, loading: allocationsLoading } = useAllocations({
    vaultAddress,
    chainId,
    caps: allCaps,
    enabled: !needsAdapterDeployment && !!vaultData?.capsData,
  });

  // Unified refetch function
  const refetchAll = useCallback(() => {
    void refetchVaultData();
    void refetchContract();
    void refetchAdapter();
  }, [refetchVaultData, refetchContract, refetchAdapter]);

  // Loading states
  const isLoading = vaultDataLoading || contractLoading || adapterLoading;
  const hasError = !!vaultDataError;

  return {
    // Data
    vaultData,
    totalAssets,
    allocations,
    adapter: morphoMarketV1Adapter,
    onChainName,
    onChainSymbol,

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
