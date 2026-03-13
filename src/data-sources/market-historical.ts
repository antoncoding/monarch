import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarketHistoricalData } from '@/data-sources/envio/historical';
import { fetchMorphoMarketHistoricalData, type HistoricalDataSuccessResult } from '@/data-sources/morpho-api/historical';
import { fetchSubgraphMarketHistoricalData } from '@/data-sources/subgraph/historical';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

export const fetchMarketHistoricalData = async (
  uniqueKey: string,
  network: SupportedNetworks,
  options: TimeseriesOptions,
  requestOptions: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<HistoricalDataSuccessResult | null> => {
  const { customRpcUrls } = requestOptions;

  if (hasEnvioIndexer()) {
    try {
      const envioData = await fetchEnvioMarketHistoricalData(uniqueKey, network, options, {
        customRpcUrls,
      });

      if (envioData) {
        return envioData;
      }
    } catch (envioError) {
      console.error('Failed to fetch historical data via Envio:', envioError);
    }
  }

  if (supportsMorphoApi(network)) {
    try {
      const morphoData = await fetchMorphoMarketHistoricalData(uniqueKey, network, options);

      if (morphoData) {
        return morphoData;
      }
    } catch (morphoError) {
      console.error('Failed to fetch historical data via Morpho API:', morphoError);
    }
  }

  return fetchSubgraphMarketHistoricalData(uniqueKey, network, options);
};
