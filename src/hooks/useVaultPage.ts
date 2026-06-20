import { useMemo } from 'react';
import type { Address } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { supportsMorphoApiChainId } from '@/config/dataSources';
import { fetchMorphoVaultV2Apy } from '@/data-sources/morpho-api/vaults';
import type { SupportedNetworks } from '@/utils/networks';
import { getVaultReadKey } from '@/utils/vaultAllocation';
import { fetchVaultYieldSnapshots } from '@/utils/vaultYield';
import { useMorphoMarketAdapters } from './useMorphoMarketAdapters';
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
 *
 * DON'T use this for:
 * - Raw data (use useVaultV2Data, etc. directly)
 * - Simple 1-liner computations (do in component)
 */
export function useVaultPage({ vaultAddress, chainId, connectedAddress }: UseVaultPageArgs) {
  const { customRpcUrls } = useCustomRpcContext();
  const customRpcUrl = customRpcUrls[chainId];
  // Pull only what we need for computations
  const vaultDataQuery = useVaultV2Data({ vaultAddress, chainId });
  const contract = useVaultV2({ vaultAddress, chainId, connectedAddress, onTransactionSuccess: vaultDataQuery.refetch });
  const adapterQuery = useMorphoMarketAdapters({ vaultAddress, chainId });
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

  const localVaultApyQuery = useQuery({
    queryKey: ['vault-v2-local-apy', vaultAddress.toLowerCase(), chainId, customRpcUrl ?? null],
    queryFn: async () => {
      const snapshots = await fetchVaultYieldSnapshots({
        vaults: [{ address: vaultAddress, networkId: chainId }],
        customRpcUrls: { [chainId]: customRpcUrl },
      });

      return snapshots.get(getVaultReadKey(vaultAddress, chainId))?.vaultApy ?? null;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const localVaultApy = localVaultApyQuery.data;
  const hasLocalVaultApy = typeof localVaultApy === 'number' && Number.isFinite(localVaultApy);
  const shouldFetchMorphoVaultApy = supportsMorphoApiChainId(chainId) && !localVaultApyQuery.isLoading && !hasLocalVaultApy;
  const vaultV2ApyQuery = useQuery({
    queryKey: ['morpho-vault-v2-apy', vaultAddress.toLowerCase(), chainId],
    queryFn: () => fetchMorphoVaultV2Apy(vaultAddress, chainId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: shouldFetchMorphoVaultApy,
  });

  const vaultAPY = useMemo(() => {
    if (typeof localVaultApy === 'number' && Number.isFinite(localVaultApy)) {
      return localVaultApy;
    }

    if (localVaultApyQuery.isLoading && localVaultApy === undefined) {
      return null;
    }

    const morphoVaultApy = vaultV2ApyQuery.data;
    if (typeof morphoVaultApy === 'number' && Number.isFinite(morphoVaultApy)) {
      return morphoVaultApy;
    }

    if (shouldFetchMorphoVaultApy && vaultV2ApyQuery.isLoading && morphoVaultApy === undefined) {
      return null;
    }

    return null;
  }, [localVaultApy, localVaultApyQuery.isLoading, shouldFetchMorphoVaultApy, vaultV2ApyQuery.data, vaultV2ApyQuery.isLoading]);

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

  // Return ONLY computed/derived state - no raw data!
  return {
    // Complex computed state
    isVaultInitialized,
    needsAdapterDeployment,
    needsInitialization,
    vaultAPY,
    vault24hEarnings: null,
    isAPYLoading: localVaultApyQuery.isLoading || (shouldFetchMorphoVaultApy && vaultV2ApyQuery.isLoading),
  };
}
