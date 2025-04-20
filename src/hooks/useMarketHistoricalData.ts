import { useQuery } from '@tanstack/react-query';
import { SupportedNetworks } from '@/utils/networks';
import { TimeseriesOptions } from '@/utils/types';
import { getHistoricalDataSource } from '@/config/dataSources';
import {
  fetchMorphoMarketHistoricalData,
  HistoricalDataSuccessResult,
} from '@/data-sources/morpho-api/historical';
import {
  fetchSubgraphMarketHistoricalData,
} from '@/data-sources/subgraph/historical';

export const useMarketHistoricalData = (
  uniqueKey: string | undefined,
  network: SupportedNetworks | undefined,
  options: TimeseriesOptions | undefined,
) => {
  const queryKey = [
    'marketHistoricalData',
    uniqueKey,
    network,
    options?.startTimestamp,
    options?.endTimestamp,
    options?.interval,
  ];

  const dataSource = network ? getHistoricalDataSource(network) : null;

  const { data, isLoading, error, refetch } = useQuery<
    HistoricalDataSuccessResult | null
  >({
    queryKey: queryKey,
    queryFn: async (): Promise<HistoricalDataSuccessResult | null> => {
      if (!uniqueKey || !network || !options || !dataSource) {
        console.log('Historical data prerequisites not met or source unavailable.', {
          uniqueKey, network, options, dataSource
        });
        return null;
      }

      console.log(`Fetching historical data for ${uniqueKey} on ${network} via ${dataSource}`);

      if (dataSource === 'morpho') {
        const res = await fetchMorphoMarketHistoricalData(uniqueKey, network, options);
        console.log('res morpho', res);
        return res;
      } else if (dataSource === 'subgraph') {
        const res = await fetchSubgraphMarketHistoricalData(uniqueKey, network, options);
        console.log('res', res);
        return res;
      }
      
      console.warn("Unknown historical data source determined");
      return null;
    },
    enabled: !!uniqueKey && !!network && !!options && !!dataSource,
    staleTime: 1000 * 60 * 5,
    placeholderData: null,
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