import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketHistoricalData, type HistoricalDataSuccessResult } from '@/data-sources/morpho-api/historical';
import { fetchSubgraphMarketHistoricalData } from '@/data-sources/subgraph/historical';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

export const useMarketHistoricalData = (
  uniqueKey: string | undefined,
  network: SupportedNetworks | undefined,
  options: TimeseriesOptions | undefined,
) => {
  const queryKey = ['marketHistoricalData', uniqueKey, network, options?.startTimestamp, options?.endTimestamp, options?.interval];

  const { data, isLoading, error, refetch } = useQuery<HistoricalDataSuccessResult | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<HistoricalDataSuccessResult | null> => {
      if (!uniqueKey || !network || !options) {
        console.log('Historical data prerequisites not met.', {
          uniqueKey,
          network,
          options,
        });
        return null;
      }

      let historicalData: HistoricalDataSuccessResult | null = null;

      // Try Morpho API first if supported
      if (supportsMorphoApi(network)) {
        try {
          console.log(`Attempting to fetch historical data via Morpho API for ${uniqueKey}`);
          historicalData = await fetchMorphoMarketHistoricalData(uniqueKey, network, options);
        } catch (morphoError) {
          console.error('Failed to fetch historical data via Morpho API:', morphoError);
          // Continue to Subgraph fallback
        }
      }

      // If Morpho API failed or not supported, try Subgraph
      if (!historicalData) {
        try {
          console.log(`Attempting to fetch historical data via Subgraph for ${uniqueKey}`);
          historicalData = await fetchSubgraphMarketHistoricalData(uniqueKey, network, options);
        } catch (subgraphError) {
          console.error('Failed to fetch historical data via Subgraph:', subgraphError);
          historicalData = null;
        }
      }

      return historicalData;
    },
    enabled: !!uniqueKey && !!network && !!options,
    staleTime: 1000 * 60 * 5,
    placeholderData: null,
    retry: 1,
  });

  return {
    data: data,
    isLoading: isLoading,
    error: error,
    refetch: refetch,
  };
};
