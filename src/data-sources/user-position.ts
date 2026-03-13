import { hasEnvioIndexer, supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioUserPositionForMarket } from '@/data-sources/envio/positions';
import { fetchMorphoUserPositionForMarket } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphUserPositionForMarket } from '@/data-sources/subgraph/positions';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketPosition } from '@/utils/types';

export const fetchUserPositionForMarket = async (
  marketUniqueKey: string,
  userAddress: string,
  chainId: SupportedNetworks,
): Promise<MarketPosition | null> => {
  if (hasEnvioIndexer()) {
    try {
      const envioPosition = await fetchEnvioUserPositionForMarket(marketUniqueKey, userAddress, chainId);

      if (envioPosition) {
        return envioPosition;
      }
    } catch (envioError) {
      console.error('Failed to fetch position via Envio:', envioError);
    }
  }

  if (supportsMorphoApi(chainId)) {
    try {
      const morphoPosition = await fetchMorphoUserPositionForMarket(marketUniqueKey, userAddress, chainId);

      if (morphoPosition) {
        return morphoPosition;
      }
    } catch (morphoError) {
      console.error('Failed to fetch position via Morpho API:', morphoError);
    }
  }

  return fetchSubgraphUserPositionForMarket(marketUniqueKey, userAddress, chainId);
};
