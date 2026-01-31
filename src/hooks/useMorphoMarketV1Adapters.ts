import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { fetchVaultV2Details } from '@/data-sources/morpho-api/v2-vaults';
import type { SupportedNetworks } from '@/utils/networks';
import { useExistingAdapterOnChain } from './useExistingAdapterOnChain';

export type MorphoMarketV1AdapterRecord = {
  id: string;
  adapter: Address;
  parentVault: Address;
};

export function useMorphoMarketV1Adapters({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
  // On-chain check as fallback when API hasn't indexed the adapter yet
  const { existingAdapter: onChainAdapter, isLoading: isLoadingOnChain } = useExistingAdapterOnChain({
    vaultAddress,
    chainId,
  });

  const query = useQuery({
    queryKey: ['morpho-market-v1-adapters', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) {
        return [];
      }

      // Fetch vault details from Morpho API - adapters are included in the response
      const vaultDetails = await fetchVaultV2Details(vaultAddress, chainId);

      if (!vaultDetails) {
        return [];
      }

      // The adapters array from the API contains addresses
      // We return them in a format compatible with the previous subgraph response
      return vaultDetails.adapters.map((adapterAddress, index) => ({
        id: `${vaultAddress}-${index}`,
        adapter: adapterAddress as Address,
        parentVault: vaultAddress,
      }));
    },
    enabled: Boolean(vaultAddress),
    staleTime: 30_000, // 30 seconds - adapter data is cacheable
  });

  // Prioritize on-chain check over API data (on-chain is source of truth)
  const adaptersFromApi = query.data ?? [];
  const adapters = useMemo(() => {
    // On-chain check first - this is the source of truth
    if (onChainAdapter) {
      return [
        {
          id: `${vaultAddress}-onchain-0`,
          adapter: onChainAdapter,
          parentVault: vaultAddress as Address,
        },
      ];
    }
    // Fallback to API data if on-chain check hasn't returned yet or factory not configured
    if (adaptersFromApi.length > 0) {
      return adaptersFromApi;
    }
    return [];
  }, [onChainAdapter, adaptersFromApi, vaultAddress]);

  // For now, we just return the first adapter as the MorphoMarketV1 adapter
  // In the future, we may need to filter by type if multiple adapter types exist
  const morphoMarketV1Adapter = useMemo(() => (adapters.length > 0 ? adapters[0].adapter : zeroAddress), [adapters]);

  return {
    morphoMarketV1Adapter,
    adapters,
    isLoading: query.isLoading || isLoadingOnChain,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    hasAdapters: adapters.length > 0,
  };
}
