import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { fetchVaultV2Details } from '@/data-sources/morpho-api/v2-vaults';
import { batchIsMorphoMarketV1Adapter } from '@/utils/adapter-validation';
import { useVaultKeysCache, combineAddresses } from '@/stores/useVaultKeysCache';
import type { SupportedNetworks } from '@/utils/networks';

export type MorphoMarketV1AdapterRecord = {
  id: string;
  adapter: Address;
  parentVault: Address;
};

export function useMorphoMarketV1Adapters({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
  const { getVaultKeys, seedFromApi } = useVaultKeysCache(vaultAddress, chainId);

  const query = useQuery({
    queryKey: ['morpho-market-v1-adapters', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) return [];

      // Stage 1: Discovery (API + cache)
      let apiAdapters: string[] = [];
      try {
        const vaultDetails = await fetchVaultV2Details(vaultAddress, chainId);
        if (vaultDetails) {
          apiAdapters = vaultDetails.adapters;
          // Seed cache with API data
          seedFromApi({ adapters: apiAdapters });
        }
      } catch (error) {
        console.warn('[useMorphoMarketV1Adapters] API fetch failed, using cache:', error);
      }

      // Merge API + cached adapters
      const cachedKeys = getVaultKeys();
      const allAdapters = combineAddresses(apiAdapters, cachedKeys.adapters);

      if (allAdapters.length === 0) return [];

      // Stage 2: RPC validation against factory contracts
      const validationResults = await batchIsMorphoMarketV1Adapter(allAdapters as Address[], chainId);

      // Return only valid adapters
      return validationResults
        .filter((r) => r.isValid)
        .map((r) => ({
          id: `${vaultAddress}-${r.address}`,
          adapter: r.address,
          parentVault: vaultAddress,
        }));
    },
    enabled: Boolean(vaultAddress),
    staleTime: 30_000, // 30 seconds - adapter data is cacheable
  });

  // For now, we just return the first adapter as the MorphoMarketV1 adapter
  // In the future, we may need to filter by type if multiple adapter types exist
  const morphoMarketV1Adapter = useMemo(() => (query.data && query.data.length > 0 ? query.data[0].adapter : zeroAddress), [query.data]);

  return {
    morphoMarketV1Adapter,
    adapters: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    hasAdapters: (query.data ?? []).length > 0,
  };
}
