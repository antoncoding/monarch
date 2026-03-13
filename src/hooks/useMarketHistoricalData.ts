import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { fetchMarketHistoricalData } from '@/data-sources/market-historical';
import type { HistoricalDataSuccessResult } from '@/data-sources/morpho-api/historical';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

export const useMarketHistoricalData = (
  uniqueKey: string | undefined,
  network: SupportedNetworks | undefined,
  options: TimeseriesOptions | undefined,
) => {
  const { customRpcUrls, rpcConfigVersion } = useCustomRpcContext();
  const queryKey = ['marketHistoricalData', uniqueKey, network, options?.startTimestamp, options?.endTimestamp, options?.interval, rpcConfigVersion];

  const { data, isLoading, error, refetch } = useQuery<HistoricalDataSuccessResult | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<HistoricalDataSuccessResult | null> => {
      if (!uniqueKey || !network || !options) {
        return null;
      }

      return fetchMarketHistoricalData(uniqueKey, network, options, {
        customRpcUrls,
      });
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
