import { useQuery } from '@tanstack/react-query';
import { fetchMorphoMarketMetadata } from '@/data-sources/morpho-api/market-metadata';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketMetadata } from '@/utils/types';

export const useMarketMetadataQuery = (uniqueKey: string | undefined, chainId: SupportedNetworks | undefined) => {
  return useQuery<MarketMetadata | null>({
    queryKey: ['market-metadata', uniqueKey, chainId],
    queryFn: async () => {
      if (!uniqueKey || !chainId) {
        return null;
      }

      return fetchMorphoMarketMetadata(uniqueKey, chainId);
    },
    enabled: !!uniqueKey && !!chainId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData ?? null,
  });
};
