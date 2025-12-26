import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { fetchMorphoMarketV1Adapters } from '@/data-sources/subgraph/morpho-market-v1-adapters';
import { getMorphoAddress } from '@/utils/morpho';
import { getNetworkConfig, type SupportedNetworks } from '@/utils/networks';

export function useMorphoMarketV1Adapters({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
  const vaultConfig = useMemo(() => {
    try {
      return getNetworkConfig(chainId).vaultConfig;
    } catch (_err) {
      return undefined;
    }
  }, [chainId]);

  const subgraphUrl = vaultConfig?.adapterSubgraphEndpoint ?? null;
  const morpho = useMemo(() => getMorphoAddress(chainId), [chainId]);

  const query = useQuery({
    queryKey: ['morpho-market-v1-adapters', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress || !subgraphUrl) {
        return [];
      }

      const result = await fetchMorphoMarketV1Adapters({
        subgraphUrl,
        parentVault: vaultAddress,
        morpho,
      });

      return result;
    },
    enabled: Boolean(vaultAddress && subgraphUrl),
    staleTime: 30_000, // 30 seconds - adapter data is cacheable
  });

  const morphoMarketV1Adapter = useMemo(
    () => (query.data && query.data.length > 0 ? query.data[0].adapter : zeroAddress),
    [query.data],
  );

  return {
    morphoMarketV1Adapter,
    adapters: query.data ?? [], // all market adapters (should only be just one)
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    hasAdapters: (query.data ?? []).length > 0,
  };
}
