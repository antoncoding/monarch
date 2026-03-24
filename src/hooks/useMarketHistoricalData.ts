import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchMarketHistoricalData } from '@/data-sources/monarch-api/historical';
import { fetchMorphoMarketHistoricalData, type HistoricalDataSuccessResult } from '@/data-sources/morpho-api/historical';
import { fetchSubgraphMarketHistoricalData } from '@/data-sources/subgraph/historical';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

const hasUsdSeries = (historicalData: HistoricalDataSuccessResult): boolean =>
  historicalData.volumes.supplyAssetsUsd.length > 0 &&
  historicalData.volumes.borrowAssetsUsd.length > 0 &&
  historicalData.volumes.liquidityAssetsUsd.length > 0;

const mergeUsdFallback = (
  primaryData: HistoricalDataSuccessResult,
  fallbackData: HistoricalDataSuccessResult,
): HistoricalDataSuccessResult => ({
  rates: primaryData.rates,
  volumes: {
    ...primaryData.volumes,
    supplyAssetsUsd: primaryData.volumes.supplyAssetsUsd.length > 0 ? primaryData.volumes.supplyAssetsUsd : fallbackData.volumes.supplyAssetsUsd,
    borrowAssetsUsd: primaryData.volumes.borrowAssetsUsd.length > 0 ? primaryData.volumes.borrowAssetsUsd : fallbackData.volumes.borrowAssetsUsd,
    liquidityAssetsUsd:
      primaryData.volumes.liquidityAssetsUsd.length > 0 ? primaryData.volumes.liquidityAssetsUsd : fallbackData.volumes.liquidityAssetsUsd,
  },
});

const fetchUsdBackfill = async (
  uniqueKey: string,
  network: SupportedNetworks,
  options: TimeseriesOptions,
): Promise<HistoricalDataSuccessResult | null> => {
  if (supportsMorphoApi(network)) {
    try {
      console.log(`Attempting to backfill USD historical data via Morpho API for ${uniqueKey}`);
      const morphoHistoricalData = await fetchMorphoMarketHistoricalData(uniqueKey, network, options);
      if (morphoHistoricalData) {
        return morphoHistoricalData;
      }
    } catch (morphoUsdError) {
      console.error('Failed to backfill USD historical data via Morpho API:', morphoUsdError);
    }
  }

  try {
    console.log(`Attempting to backfill USD historical data via Subgraph for ${uniqueKey}`);
    return await fetchSubgraphMarketHistoricalData(uniqueKey, network, options);
  } catch (subgraphUsdError) {
    console.error('Failed to backfill USD historical data via Subgraph:', subgraphUsdError);
    return null;
  }
};

export const useMarketHistoricalData = (
  uniqueKey: string | undefined,
  network: SupportedNetworks | undefined,
  options: TimeseriesOptions | undefined,
  includeUsd = false,
) => {
  const queryKey = ['marketHistoricalData', uniqueKey, network, options?.startTimestamp, options?.endTimestamp, options?.interval, includeUsd];

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

      try {
        console.log(`Attempting to fetch historical data via Monarch API for ${uniqueKey}`);
        historicalData = await fetchMonarchMarketHistoricalData(uniqueKey, network, options);
      } catch (monarchError) {
        console.error('Failed to fetch historical data via Monarch API:', monarchError);
      }

      if (historicalData) {
        if (!includeUsd || hasUsdSeries(historicalData)) {
          return historicalData;
        }

        const usdBackfill = await fetchUsdBackfill(uniqueKey, network, options);
        if (usdBackfill) {
          return mergeUsdFallback(historicalData, usdBackfill);
        }

        return historicalData;
      }

      // Try Morpho API next if supported
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
