import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { supportsMorphoApi } from '@/config/dataSources';
import { useOracleDataContext } from '@/contexts/OracleDataContext';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarket } from '@/data-sources/subgraph/market';
import type { SupportedNetworks } from '@/utils/networks';
import { fetchMarketSnapshot } from '@/utils/positions';
import type { Market } from '@/utils/types';

export const useMarketData = (uniqueKey: string | undefined, network: SupportedNetworks | undefined) => {
  const queryKey = ['marketData', uniqueKey, network];
  const publicClient = usePublicClient({ chainId: network });
  const { getOracleData } = useOracleDataContext();

  const { data, isLoading, error, refetch } = useQuery<Market | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<Market | null> => {
      console.log('fetching market');

      if (!uniqueKey || !network) {
        return null;
      }

      if (!publicClient) {
        console.error('Public client not available');
        return null;
      }

      // 1. Try fetching the on-chain market snapshot first
      console.log(`Attempting fetchMarketSnapshot for market ${uniqueKey}`);
      let snapshot = null;
      try {
        snapshot = await fetchMarketSnapshot(uniqueKey, network, publicClient, 0);
        console.log(`Market state (from RPC) result for ${uniqueKey}:`, snapshot ? 'Exists' : 'Null');
      } catch (snapshotError) {
        console.error(`Error fetching market snapshot for ${uniqueKey}:`, snapshotError);
        // Snapshot fetch failed, will proceed to fallback fetch
      }

      let finalMarket: Market | null = null;

      // 2. Try Morpho API first if supported, then fallback to Subgraph
      try {
        if (supportsMorphoApi(network)) {
          console.log(`Attempting to fetch market data via Morpho API for ${uniqueKey}`);
          finalMarket = await fetchMorphoMarket(uniqueKey, network);
        }
      } catch (morphoError) {
        console.error('Failed to fetch market data via Morpho API:', morphoError);
        // Continue to Subgraph fallback
      }

      // 3. If Morpho API failed or not supported, try Subgraph
      if (!finalMarket) {
        try {
          console.log(`Attempting to fetch market data via Subgraph for ${uniqueKey}`);
          finalMarket = await fetchSubgraphMarket(uniqueKey, network);
        } catch (subgraphError) {
          console.error('Failed to fetch market data via Subgraph:', subgraphError);
          finalMarket = null;
        }
      }

      // 4. If we have both snapshot and market data, override the state fields with snapshot
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
        // Both data sources failed
        console.error(`Failed to fetch market data for ${uniqueKey} via both Morpho API and Subgraph.`);
        finalMarket = null;
      } else if (!snapshot) {
        // Snapshot failed but data source succeeded - just use data source
        console.warn(`Market snapshot failed for ${uniqueKey}, using data source only.`);
      }

      console.log(`Final market data for ${uniqueKey}:`, finalMarket ? 'Found' : 'Not Found');

      return finalMarket;
    },
    enabled: !!uniqueKey && !!network,
    staleTime: 1000 * 60 * 2,
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  // Enrich with oracle data OUTSIDE the query to avoid re-triggering the entire fetch
  // when oracle data context updates
  const enrichedMarket = useMemo(() => {
    if (!data || !network) return data;

    const oracleData = getOracleData(data.oracleAddress, network);

    if (oracleData) {
      return {
        ...data,
        oracle: {
          data: oracleData,
        },
      };
    }

    return data;
  }, [data, network, getOracleData]);

  return {
    data: enrichedMarket,
    isLoading: isLoading,
    error: error,
    refetch: refetch,
  };
};
