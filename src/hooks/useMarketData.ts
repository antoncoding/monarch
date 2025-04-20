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

  // Determine the data source
  const dataSource = network ? getMarketDataSource(network) : null;

  const { data, isLoading, error, refetch } = useQuery<Market | null>({
    // Allow null return
    queryKey: queryKey,
    queryFn: async (): Promise<Market | null> => {
      // Guard clauses
      if (!uniqueKey || !network || !dataSource) {
        return null; // Return null if prerequisites aren't met
      }

      console.log(`Fetching market data for ${uniqueKey} on ${network} via ${dataSource}`);

      // Fetch based on the determined data source
      try {
        if (dataSource === 'morpho') {
          return await fetchMorphoMarket(uniqueKey, network);
        } else if (dataSource === 'subgraph') {
          // fetchSubgraphMarket already handles potential null return
          return await fetchSubgraphMarket(uniqueKey, network);
        }
      } catch (fetchError) {
        console.error(`Failed to fetch market data via ${dataSource}:`, fetchError);
        return null; // Return null on fetch error
      }

      // Fallback if dataSource logic is somehow incorrect
      console.warn('Unknown market data source determined');
      return null;
    },
    // Enable query only if all parameters are present AND a valid data source exists
    enabled: !!uniqueKey && !!network && !!dataSource,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: (previousData) => previousData ?? null,
    retry: 1, // Optional: retry once on failure
  });

  return {
    data: data,
    isLoading: isLoading,
    error: error,
    refetch: refetch,
    dataSource: dataSource, // Expose the determined data source
  };
};
