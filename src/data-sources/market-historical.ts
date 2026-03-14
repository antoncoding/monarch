import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarketHistoricalData } from '@/data-sources/envio/historical';
import { fetchMorphoMarketHistoricalData, type HistoricalDataSuccessResult } from '@/data-sources/morpho-api/historical';
import { getErrorMessage, logDataSourceEvent } from '@/data-sources/shared/source-debug';
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
        logDataSourceEvent('market-historical', 'using Envio historical source', {
          chainId: network,
          marketUniqueKey: uniqueKey,
        });
        return envioData;
      }
    } catch (error) {
      logDataSourceEvent('market-historical', 'Envio historical fetch failed, falling back', {
        chainId: network,
        marketUniqueKey: uniqueKey,
        reason: getErrorMessage(error),
      });
    }
  }

  if (supportsMorphoApi(network)) {
    try {
      const morphoData = await fetchMorphoMarketHistoricalData(uniqueKey, network, options);

      if (morphoData) {
        logDataSourceEvent('market-historical', 'using Morpho API fallback for historical data', {
          chainId: network,
          marketUniqueKey: uniqueKey,
        });
        return morphoData;
      }
    } catch (error) {
      logDataSourceEvent('market-historical', 'Morpho historical fetch failed, falling back to subgraph', {
        chainId: network,
        marketUniqueKey: uniqueKey,
        reason: getErrorMessage(error),
      });
    }
  }

  logDataSourceEvent('market-historical', 'using subgraph fallback for historical data', {
    chainId: network,
    marketUniqueKey: uniqueKey,
  });
  return fetchSubgraphMarketHistoricalData(uniqueKey, network, options);
};
