import { useQuery } from '@tanstack/react-query';
import { fetchMorphoMarketsMetadataMultiChain } from '@/data-sources/morpho-api/market-metadata';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import type { MarketMetadata } from '@/utils/types';

const EMPTY_MARKET_METADATA_MAP = new Map<string, MarketMetadata>();

export const useMarketsMetadataQuery = () => {
  return useQuery({
    queryKey: ['markets-metadata'],
    queryFn: () => fetchMorphoMarketsMetadataMultiChain(ALL_SUPPORTED_NETWORKS),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: () => EMPTY_MARKET_METADATA_MAP,
  });
};
