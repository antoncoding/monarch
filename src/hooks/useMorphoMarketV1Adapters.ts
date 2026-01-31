import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { fetchVaultV2Details } from '@/data-sources/morpho-api/v2-vaults';
import type { SupportedNetworks } from '@/utils/networks';

export type MorphoMarketV1AdapterRecord = {
  id: string;
  adapter: Address;
  parentVault: Address;
};

export function useMorphoMarketV1Adapters({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
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
