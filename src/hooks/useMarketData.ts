import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketDetails } from '@/data-sources/market-details';
import { applyMarketMetadata } from '@/data-sources/shared/market-metadata';
import { useMarketMetadataQuery } from '@/hooks/queries/useMarketMetadataQuery';
import { useOracleDataQuery } from '@/hooks/queries/useOracleDataQuery';
import { useReadOnlyClient } from '@/hooks/useReadOnlyClient';
import type { SupportedNetworks } from '@/utils/networks';
import { fetchMarketSnapshot } from '@/utils/positions';
import type { Market } from '@/utils/types';

export const useMarketData = (uniqueKey: string | undefined, network: SupportedNetworks | undefined) => {
  const { client, customRpcUrls, rpcConfigVersion } = useReadOnlyClient(network);
  const queryKey = ['marketData', uniqueKey, network, rpcConfigVersion];
  const { getOracleData } = useOracleDataQuery();
  const { data: marketMetadata, error: marketMetadataError, refetch: refetchMarketMetadata } = useMarketMetadataQuery(uniqueKey, network);

  const { data, isLoading, error, refetch } = useQuery<Market | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<Market | null> => {
      if (!uniqueKey || !network) {
        return null;
      }

      if (!client) {
        console.error('Public client not available');
        return null;
      }

      // 1. Try fetching the on-chain market snapshot first
      let snapshot = null;
      try {
        snapshot = await fetchMarketSnapshot(uniqueKey, network, client);
      } catch (snapshotError) {
        console.error(`Error fetching market snapshot for ${uniqueKey}:`, snapshotError);
        // Snapshot fetch failed, will proceed to fallback fetch
      }

      const finalMarket = await fetchMarketDetails(uniqueKey, network, {
        customRpcUrls,
        enrichHistoricalApys: true,
      });

      // 3. If we have both snapshot and market data, override the state fields with snapshot
      if (snapshot && finalMarket) {
        return {
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
      }

      if (!finalMarket) {
        // Both data sources failed
        console.error(`Failed to fetch market data for ${uniqueKey} via Envio and fallback sources.`);
        return null;
      }

      if (!snapshot) {
        // Snapshot failed but data source succeeded - just use data source
        console.warn(`Market snapshot failed for ${uniqueKey}, using data source only.`);
      }

      return finalMarket;
    },
    enabled: !!uniqueKey && !!network,
    staleTime: 30_000, // 30 seconds - individual market view needs accuracy
    refetchInterval: 30_000, // Match staleTime for consistency
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  // Enrich with oracle data OUTSIDE the query to avoid re-triggering the entire fetch
  // when oracle data context updates
  const enrichedMarket = useMemo(() => {
    if (!data || !network) return data;

    const marketWithMetadata = applyMarketMetadata(data, marketMetadata);
    const oracleData = getOracleData(marketWithMetadata.oracleAddress, network);

    if (oracleData) {
      return {
        ...marketWithMetadata,
        oracle: {
          data: oracleData,
        },
      };
    }

    return marketWithMetadata;
  }, [data, marketMetadata, network, getOracleData]);

  return {
    data: enrichedMarket,
    isLoading: isLoading,
    error: error ?? (!data ? marketMetadataError : null),
    refetch: async () => {
      await Promise.all([refetch(), refetchMarketMetadata()]);
    },
  };
};
