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

export type VaultPageData = {
  // Raw data from queries
  vaultData: ReturnType<typeof useVaultV2Data>['data'];
  totalAssets: bigint | undefined;
  adapter: Address;
  onChainName: string;
  onChainSymbol: string;

  // Allocations
  collateralAllocations: ReturnType<typeof useVaultAllocations>['collateralAllocations'];
  marketAllocations: ReturnType<typeof useVaultAllocations>['marketAllocations'];

  // APY & Earnings
  vaultAPY: number | null;
  vault24hEarnings: bigint | null;
  isAPYLoading: boolean;

  // Computed state
  isOwner: boolean;
  needsAdapterDeployment: boolean;
  needsInitialization: boolean;
  isVaultInitialized: boolean;
  hasNoAllocators: boolean;
  capsUninitialized: boolean;

  // Loading/Error states
  isLoading: boolean;
  vaultDataLoading: boolean;
  allocationsLoading: boolean;
  adapterLoading: boolean;
  hasError: boolean;

  // Actions
  completeInitialization: ReturnType<typeof useVaultV2>['completeInitialization'];
  updateNameAndSymbol: ReturnType<typeof useVaultV2>['updateNameAndSymbol'];
  setAllocator: ReturnType<typeof useVaultV2>['setAllocator'];
  updateCaps: ReturnType<typeof useVaultV2>['updateCaps'];
  refetchAll: () => void;
  refetchAdapter: () => void;

  // Action loading states
  isInitializing: boolean;
  isUpdatingMetadata: boolean;
  isUpdatingAllocator: boolean;
  isUpdatingCaps: boolean;
};

/**
 * Unified hook for vault page data and actions.
 * Combines all vault-related data fetching and provides computed state.
 *
 * Supports selector pattern for performance:
 * @example
 * // Get all data
 * const vault = useVaultPage({ vaultAddress, chainId });
 *
 * // Get only specific fields (prevents unnecessary re-renders)
 * const vault = useVaultPage(
 *   { vaultAddress, chainId },
 *   (d) => ({ vaultAPY: d.vaultAPY, isOwner: d.isOwner })
 * );
 */
export function useVaultPage<T = VaultPageData>(
  { vaultAddress, chainId, connectedAddress }: UseVaultPageArgs,
  selector?: (data: VaultPageData) => T
): T extends VaultPageData ? VaultPageData & { data: T } : VaultPageData {
  // Fetch vault data from API/subgraph
  const vaultDataQuery = useVaultV2Data({
    vaultAddress,
    chainId,
  });

  // Memoize transaction success handler to prevent infinite refetch loops
  const handleTransactionSuccess = useCallback(() => {
    void vaultDataQuery.refetch();
  }, [vaultDataQuery]);

  // Fetch vault contract state and actions
  const contract = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
    onTransactionSuccess: handleTransactionSuccess,
  });

  // Fetch market adapter
  const adapterQuery = useMorphoMarketV1Adapters({ vaultAddress, chainId });

  // Compute initialization state
  const isVaultInitialized = useMemo(() => {
    if (adapterQuery.isLoading || vaultDataQuery.isLoading) {
      return false;
    }
    if (adapterQuery.morphoMarketV1Adapter === zeroAddress) {
      return false;
    }
    return vaultDataQuery.data !== null && vaultDataQuery.data !== undefined;
  }, [adapterQuery.isLoading, vaultDataQuery.isLoading, adapterQuery.morphoMarketV1Adapter, vaultDataQuery.data]);

  const needsAdapterDeployment = useMemo(
    () => !adapterQuery.isLoading && adapterQuery.morphoMarketV1Adapter === zeroAddress,
    [adapterQuery.isLoading, adapterQuery.morphoMarketV1Adapter],
  );

  // Fetch and parse allocations with typed structures
  const allocationsQuery = useVaultAllocations({
    collateralCaps: vaultDataQuery.data?.capsData?.collateralCaps ?? [],
    marketCaps: vaultDataQuery.data?.capsData?.marketCaps ?? [],
    vaultAddress,
    chainId,
    enabled: !needsAdapterDeployment && !!vaultDataQuery.data?.capsData,
  });

  // Fetch adapter positions for APY calculation (only last 24h, only current chain)
  const { positions: adapterPositions, isEarningsLoading: isAPYLoading } = useUserPositionsSummaryData(
    !needsAdapterDeployment && adapterQuery.morphoMarketV1Adapter !== zeroAddress ? adapterQuery.morphoMarketV1Adapter : undefined,
    'day',
    [chainId],
  );

  // Calculate vault APY from adapter positions (weighted average)
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

  // Calculate total 24h earnings from adapter positions
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

  const hasNoAllocators = useMemo(
    () => !needsAdapterDeployment && (vaultDataQuery.data?.allocators ?? []).length === 0,
    [needsAdapterDeployment, vaultDataQuery.data?.allocators],
  );

  const capsUninitialized = useMemo(
    () => vaultDataQuery.data?.capsData?.needSetupCaps ?? true,
    [vaultDataQuery.data?.capsData?.needSetupCaps]
  );

  // Unified refetch function
  const refetchAll = useCallback(() => {
    void vaultDataQuery.refetch();
    void contract.refetch();
    void adapterQuery.refetch();
    void allocationsQuery.refetch();
  }, [vaultDataQuery, contract, adapterQuery, allocationsQuery]);

  // Loading states
  const isLoading = vaultDataQuery.isLoading || contract.isLoading || adapterQuery.isLoading || allocationsQuery.loading;
  const hasError = !!vaultDataQuery.error || !!allocationsQuery.error;

  // Needs initialization check
  const needsInitialization = useMemo(() => {
    if (isLoading) {
      return false;
    }
    if (isVaultInitialized) {
      return false;
    }
    return true;
  }, [isLoading, isVaultInitialized]);

  // Aggregate all data
  const aggregatedData: VaultPageData = useMemo(() => ({
    // Raw data
    vaultData: vaultDataQuery.data,
    totalAssets: contract.totalAssets,
    adapter: adapterQuery.morphoMarketV1Adapter,
    onChainName: contract.name,
    onChainSymbol: contract.symbol,

    // Allocations
    collateralAllocations: allocationsQuery.collateralAllocations,
    marketAllocations: allocationsQuery.marketAllocations,

    // APY & Earnings
    vaultAPY,
    vault24hEarnings,
    isAPYLoading,

    // Computed state
    isOwner: contract.isOwner,
    needsAdapterDeployment,
    needsInitialization,
    isVaultInitialized,
    hasNoAllocators,
    capsUninitialized,

    // Loading/Error states
    isLoading,
    vaultDataLoading: vaultDataQuery.isLoading,
    allocationsLoading: allocationsQuery.loading,
    adapterLoading: adapterQuery.isLoading,
    hasError,

    // Actions
    completeInitialization: contract.completeInitialization,
    updateNameAndSymbol: contract.updateNameAndSymbol,
    setAllocator: contract.setAllocator,
    updateCaps: contract.updateCaps,
    refetchAll,
    refetchAdapter: adapterQuery.refetch,

    // Action loading states
    isInitializing: contract.isInitializing,
    isUpdatingMetadata: contract.isUpdatingMetadata,
    isUpdatingAllocator: contract.isUpdatingAllocator,
    isUpdatingCaps: contract.isUpdatingCaps,
  }), [
    vaultDataQuery.data,
    vaultDataQuery.isLoading,
    vaultDataQuery.error,
    contract,
    adapterQuery.morphoMarketV1Adapter,
    adapterQuery.isLoading,
    adapterQuery.refetch,
    allocationsQuery.collateralAllocations,
    allocationsQuery.marketAllocations,
    allocationsQuery.loading,
    allocationsQuery.error,
    allocationsQuery.refetch,
    vaultAPY,
    vault24hEarnings,
    isAPYLoading,
    needsAdapterDeployment,
    needsInitialization,
    isVaultInitialized,
    hasNoAllocators,
    capsUninitialized,
    isLoading,
    hasError,
    refetchAll,
  ]);

  // Apply selector if provided (for performance optimization)
  if (selector) {
    const selectedData = useMemo(() => selector(aggregatedData), [selector, aggregatedData]);
    return { ...aggregatedData, data: selectedData } as any;
  }

  return aggregatedData as any;
}
