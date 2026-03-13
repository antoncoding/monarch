import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { fetchUserPositionForMarket } from '@/data-sources/user-position';
import type { SupportedNetworks } from '@/utils/networks';
import { fetchPositionSnapshot } from '@/utils/positions';
import type { MarketPosition } from '@/utils/types';
import { useProcessedMarkets } from './useProcessedMarkets';

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
const useUserPosition = (user: string | undefined, chainId: SupportedNetworks | undefined, marketKey: string | undefined) => {
  const queryKey = ['userPosition', user, chainId, marketKey];

  const { allMarkets: markets } = useProcessedMarkets();
  const publicClient = usePublicClient({ chainId });

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
        return null;
      }

      if (!publicClient) {
        console.error('Public client not available');
        return null;
      }

      // 1. Try fetching the on-chain snapshot first
      let snapshot = null;
      try {
        snapshot = await fetchPositionSnapshot(marketKey, user as Address, chainId, undefined, publicClient);
      } catch (snapshotError) {
        console.error(`Error fetching position snapshot for ${user} on market ${marketKey}:`, snapshotError);
        // Snapshot fetch failed, will proceed to fallback fetch
      }

      let finalPosition: MarketPosition | null = null;

      if (snapshot) {
        // Snapshot succeeded, try to use local market data first
        const market = markets?.find((m) => m.uniqueKey.toLowerCase() === marketKey.toLowerCase());

        if (market) {
          // Local market data found, construct position directly
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
          console.warn(`Local market data not found for ${marketKey}. Fetching from fallback source to combine with snapshot.`);
          const fallbackPosition = await fetchUserPositionForMarket(marketKey, user, chainId);

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
            console.error(`Snapshot exists for ${marketKey}, but fallback fetch failed. Cannot return full position.`);
            finalPosition = null;
          }
        }
      } else {
        // Snapshot failed, rely entirely on the fallback data source
        finalPosition = await fetchUserPositionForMarket(marketKey, user, chainId);
      }
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
