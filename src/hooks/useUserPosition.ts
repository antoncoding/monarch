import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { fetchUserPositionForMarket } from '@/data-sources/user-position';
import { useReadOnlyClient } from '@/hooks/useReadOnlyClient';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
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
  const { client, customRpcUrls, rpcConfigVersion } = useReadOnlyClient(chainId);
  const queryKey = ['userPosition', user, chainId, marketKey, rpcConfigVersion];

  const { allMarkets: markets } = useProcessedMarkets();

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

      // 1. Try fetching the on-chain snapshot first
      let snapshot = null;
      if (client) {
        try {
          snapshot = await fetchPositionSnapshot(marketKey, user as Address, chainId, undefined, client);
        } catch (snapshotError) {
          console.error(`Error fetching position snapshot for ${user} on market ${marketKey}:`, snapshotError);
          // Snapshot fetch failed, will proceed to fallback fetch
        }
      } else {
        console.warn(`Public client not available for chain ${chainId}. Using indexed position fallback.`);
      }

      let finalPosition: MarketPosition | null = null;

      if (snapshot) {
        // Snapshot succeeded, try to use local market data first
        const scopedMarketKey = getChainScopedMarketKey(marketKey, chainId);
        const market = markets?.find(
          (candidateMarket) =>
            getChainScopedMarketKey(candidateMarket.uniqueKey, candidateMarket.morphoBlue.chain.id) === scopedMarketKey,
        );

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
          const fallbackPosition = await fetchUserPositionForMarket(marketKey, user, chainId, {
            customRpcUrls,
          });

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
        finalPosition = await fetchUserPositionForMarket(marketKey, user, chainId, {
          customRpcUrls,
        });
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
