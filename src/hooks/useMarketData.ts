import { useQuery } from '@tanstack/react-query';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarket } from '@/data-sources/subgraph/market';
import { SupportedNetworks } from '@/utils/networks';
import { Market } from '@/utils/types';

export const useMarketData = (
  uniqueKey: string | undefined,
  network: SupportedNetworks | undefined,
) => {
  const queryKey = ['marketData', uniqueKey, network];

  const dataSource = network ? getMarketDataSource(network) : null;

  const { data, isLoading, error, refetch } = useQuery<Market | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<Market | null> => {
      if (!uniqueKey || !network || !dataSource) {
        return null;
      }

      console.log(`Fetching market data for ${uniqueKey} on ${network} via ${dataSource}`);

      try {
        if (dataSource === 'morpho') {
          return await fetchMorphoMarket(uniqueKey, network);
        } else if (dataSource === 'subgraph') {
          return await fetchSubgraphMarket(uniqueKey, network);
        }
      } catch (fetchError) {
        console.error(`Failed to fetch market data via ${dataSource}:`, fetchError);
        return null;
      }

      console.warn('Unknown market data source determined');
      return null;
    },
    enabled: !!uniqueKey && !!network && !!dataSource,
    staleTime: 1000 * 60 * 5,
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  return {
    data: data,
    isLoading: isLoading,
    error: error,
    refetch: refetch,
    dataSource: dataSource,
  };
};
