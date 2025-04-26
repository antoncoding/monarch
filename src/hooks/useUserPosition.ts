import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoUserPositionForMarket } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphUserPositionForMarket } from '@/data-sources/subgraph/positions';
import { SupportedNetworks } from '@/utils/networks';
import { fetchPositionSnapshot } from '@/utils/positions';
import { MarketPosition } from '@/utils/types';

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

  const { data, isLoading, error, refetch, isRefetching } = useQuery<
    MarketPosition | null,
    unknown
  >({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketPosition | null> => {
      if (!user || !chainId || !marketKey) {
        console.log('Missing user, chainId, or marketKey for useUserPosition');
        return null;
      }

      // 1. Try fetching the on-chain snapshot first
      console.log(`Attempting fetchPositionSnapshot for ${user} on market ${marketKey}`);
      const snapshot = await fetchPositionSnapshot(marketKey, user as Address, chainId, 0);

      if (snapshot) {
        // If snapshot has zero balances, treat as null position early
        if (
          snapshot.supplyAssets === '0' &&
          snapshot.borrowAssets === '0' &&
          snapshot.collateral === '0'
        ) {
          console.log(
            `Snapshot shows zero balance for ${user} on market ${marketKey}, returning null.`,
          );
          return null;
        }
      }

      // 2. Determine fallback data source
      const dataSource = getMarketDataSource(chainId);
      console.log(`Fallback data source for ${chainId}: ${dataSource}`);

      // 3. Fetch from the determined data source
      let positionData: MarketPosition | null = null;
      try {
        if (dataSource === 'morpho') {
          positionData = await fetchMorphoUserPositionForMarket(marketKey, user, chainId);
        } else if (dataSource === 'subgraph') {
          positionData = await fetchSubgraphUserPositionForMarket(marketKey, user, chainId);
        }
      } catch (fetchError) {
        console.error(
          `Failed to fetch user position via fallback (${dataSource}) for ${user} on market ${marketKey}:`,
          fetchError,
        );
        return null; // Return null on error during fallback
      }

      // If we got a snapshot earlier, overwrite the state from the fallback with the fresh snapshot state
      // Ensure the structure matches MarketPosition.state
      if (snapshot && positionData) {
        console.log(`Overwriting fallback state with fresh snapshot state for ${marketKey}`);
        positionData.state = {
          supplyAssets: snapshot.supplyAssets.toString(),
          supplyShares: snapshot.supplyShares.toString(),
          borrowAssets: snapshot.borrowAssets.toString(),
          borrowShares: snapshot.borrowShares.toString(),
          collateral: snapshot.collateral,
        };
      } else if (snapshot && !positionData) {
        // If snapshot exists but fallback failed, we cannot construct MarketPosition
        console.warn(
          `Snapshot existed but fallback failed for ${marketKey}, cannot return full MarketPosition.`,
        );
        return null;
      }

      console.log(
        `Final position data for ${user} on market ${marketKey}:`,
        positionData ? 'Found' : 'Not Found',
      );
      return positionData; // This will be null if neither snapshot nor fallback worked, or if balances were zero
    },
    enabled: !!user && !!chainId && !!marketKey,
    staleTime: 1000 * 60 * 1, // Stale after 1 minute
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
    placeholderData: (previousData) => previousData ?? null,
    retry: 1, // Retry once on error
  });

  return {
    position: data ?? null,
    loading: isLoading,
    isRefetching,
    error,
    refetch,
  };
};

export default useUserPosition;
