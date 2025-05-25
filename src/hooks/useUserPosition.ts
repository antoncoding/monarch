import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoUserPositionForMarket } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphUserPositionForMarket } from '@/data-sources/subgraph/positions';
import { SupportedNetworks } from '@/utils/networks';
import { fetchPositionSnapshot } from '@/utils/positions';
import { MarketPosition } from '@/utils/types';
import { useMarkets } from './useMarkets';

/**
 * Hook to fetch a user's position in a specific market.
 *
 * Prioritizes the latest on-chain snapshot via `fetchPositionSnapshot`.
 * Falls back to the configured data source (Morpho API or Subgraph) if the snapshot is unavailable.
 *
 * @param user The user's address.
 * @param chainId The network ID.
 * @param marketKey The unique key of the market.
 * @returns User position data, loading state, error state, and refetch function.
 */
const useUserPosition = (
  user: string | undefined,
  chainId: SupportedNetworks | undefined,
  marketKey: string | undefined,
) => {
  const queryKey = ['userPosition', user, chainId, marketKey];

  const { allMarkets: markets } = useMarkets();

  const {
    data,
    isLoading,
    error,
    refetch: refetchQuery,
    isRefetching,
  } = useQuery<MarketPosition | null, unknown>({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketPosition | null> => {
      if (!user || !chainId || !marketKey) {
        console.log('Missing user, chainId, or marketKey for useUserPosition');
        return null;
      }

      // 1. Try fetching the on-chain snapshot first
      console.log(`Attempting fetchPositionSnapshot for ${user} on market ${marketKey}`);
      let snapshot = null;
      try {
        snapshot = await fetchPositionSnapshot(marketKey, user as Address, chainId, 0);
        console.log(`Snapshot result for ${marketKey}:`, snapshot ? 'Exists' : 'Null');
      } catch (snapshotError) {
        console.error(
          `Error fetching position snapshot for ${user} on market ${marketKey}:`,
          snapshotError,
        );
        // Snapshot fetch failed, will proceed to fallback fetch
      }

      let finalPosition: MarketPosition | null = null;

      if (snapshot) {
        // Snapshot succeeded, try to use local market data first
        const market = markets?.find((m) => m.uniqueKey.toLowerCase() === marketKey.toLowerCase());

        if (market) {
          // Local market data found, construct position directly
          console.log(
            `Found local market data for ${marketKey}, constructing position from snapshot.`,
          );
          finalPosition = {
            market: market,
            state: {
              // Add state from snapshot
              supplyAssets: snapshot.supplyAssets.toString(),
              supplyShares: snapshot.supplyShares.toString(),
              borrowAssets: snapshot.borrowAssets.toString(),
              borrowShares: snapshot.borrowShares.toString(),
              collateral: snapshot.collateral,
            },
          };
        } else {
          // Local market data NOT found, need to fetch from fallback to get structure
          console.warn(
            `Local market data not found for ${marketKey}. Fetching from fallback source to combine with snapshot.`,
          );
          const dataSource = getMarketDataSource(chainId);
          let fallbackPosition: MarketPosition | null = null;
          try {
            if (dataSource === 'morpho') {
              fallbackPosition = await fetchMorphoUserPositionForMarket(marketKey, user, chainId);
            } else if (dataSource === 'subgraph') {
              fallbackPosition = await fetchSubgraphUserPositionForMarket(marketKey, user, chainId);
            }
            if (fallbackPosition) {
              // Fallback succeeded, combine with snapshot state
              finalPosition = {
                ...fallbackPosition,
                state: {
                  supplyAssets: snapshot.supplyAssets.toString(),
                  supplyShares: snapshot.supplyShares.toString(),
                  borrowAssets: snapshot.borrowAssets.toString(),
                  borrowShares: snapshot.borrowShares.toString(),
                  collateral: snapshot.collateral,
                },
              };
            } else {
              // Fallback failed even though snapshot existed
              console.error(
                `Snapshot exists for ${marketKey}, but fallback fetch failed. Cannot return full position.`,
              );
              finalPosition = null;
            }
          } catch (fetchError) {
            console.error(
              `Failed to fetch user position via fallback (${dataSource}) for ${user} on market ${marketKey} after snapshot success:`,
              fetchError,
            );
            finalPosition = null;
          }
        }
      } else {
        // Snapshot failed, rely entirely on the fallback data source
        console.log(`Snapshot failed for ${marketKey}, fetching from fallback source.`);
        const dataSource = getMarketDataSource(chainId);
        try {
          if (dataSource === 'morpho') {
            finalPosition = await fetchMorphoUserPositionForMarket(marketKey, user, chainId);
          } else if (dataSource === 'subgraph') {
            finalPosition = await fetchSubgraphUserPositionForMarket(marketKey, user, chainId);
          }
          console.log(
            `Fallback fetch result (after snapshot failure) for ${marketKey}:`,
            finalPosition ? 'Found' : 'Not Found',
          );
        } catch (fetchError) {
          console.error(
            `Failed to fetch user position via fallback (${dataSource}) for ${user} on market ${marketKey}:`,
            fetchError,
          );
          finalPosition = null; // Ensure null on error
        }
      }

      console.log(
        `Final position data for ${user} on market ${marketKey}:`,
        finalPosition ? 'Found' : 'Not Found',
      );
      // If finalPosition has zero balances, it's still a valid position state from the snapshot or fallback
      return finalPosition;
    },
    enabled: !!user && !!chainId && !!marketKey,
    staleTime: 1000 * 60 * 1, // Stale after 1 minute
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
    placeholderData: (previousData) => previousData ?? null,
    retry: 1, // Retry once on error
  });

  // refetch with onsuccess callback
  const refetch = (onSuccess?: () => void) => {
    refetchQuery()
      .then(() => {
        // Call onSuccess callback if provided after successful refetch
        onSuccess?.();
      })
      .catch((err) => {
        // Optional: Log error during refetch, but don't trigger onSuccess
        console.error('Error during refetch triggered by refetch function:', err);
      });
  };

  return {
    position: data ?? null,
    loading: isLoading,
    isRefetching,
    error,
    refetch,
  };
};

export default useUserPosition;
