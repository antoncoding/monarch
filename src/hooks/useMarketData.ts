import { useQuery } from '@tanstack/react-query';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarket } from '@/data-sources/subgraph/market';
import { SupportedNetworks } from '@/utils/networks';
import { fetchMarketSnapshot } from '@/utils/positions';
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
      console.log('fetching market');

      if (!uniqueKey || !network || !dataSource) {
        return null;
      }

      console.log(`Fetching market data for ${uniqueKey} on ${network} via ${dataSource}`);

      // 1. Try fetching the on-chain market snapshot first
      console.log(`Attempting fetchMarketSnapshot for market ${uniqueKey}`);
      let snapshot = null;
      try {
        snapshot = await fetchMarketSnapshot(uniqueKey, network);
        console.log(`Market snapshot result for ${uniqueKey}:`, snapshot ? 'Exists' : 'Null');
      } catch (snapshotError) {
        console.error(`Error fetching market snapshot for ${uniqueKey}:`, snapshotError);
        // Snapshot fetch failed, will proceed to fallback fetch
      }

      let finalMarket: Market | null = null;

      // 2. Fetch market data from fallback source
      try {
        if (dataSource === 'morpho') {
          finalMarket = await fetchMorphoMarket(uniqueKey, network);
        } else if (dataSource === 'subgraph') {
          finalMarket = await fetchSubgraphMarket(uniqueKey, network);
        }
      } catch (fetchError) {
        console.error(`Failed to fetch market data via ${dataSource}:`, fetchError);
        finalMarket = null;
      }

      // 3. If we have both snapshot and market data, override the state fields with snapshot
      if (snapshot && finalMarket) {
        console.log(`Found market snapshot for ${uniqueKey}, overriding state with on-chain data.`);
        finalMarket = {
          ...finalMarket,
          state: {
            ...finalMarket.state,
            // Override with on-chain snapshot data
            supplyAssets: snapshot.totalSupplyAssets,
            supplyShares: snapshot.totalSupplyShares,
            borrowAssets: snapshot.totalBorrowAssets,
            borrowShares: snapshot.totalBorrowShares,
            liquidityAssets: snapshot.liquidityAssets,
          },
        };
      } else if (!finalMarket) {
        // Both snapshot and fallback failed
        console.error(
          `Failed to fetch market data for ${uniqueKey} via both snapshot and fallback.`,
        );
        finalMarket = null;
      } else if (!snapshot) {
        // Snapshot failed but fallback succeeded - just use fallback
        console.warn(`Market snapshot failed for ${uniqueKey}, using fallback data source only.`);
      }

      console.log(`Final market data for ${uniqueKey}:`, finalMarket ? 'Found' : 'Not Found');

      return finalMarket;
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
