import { useState, useEffect, useCallback } from 'react';
import { userPositionForMarketQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition } from '@/utils/types';
import { URLS } from '@/utils/urls';

const useUserPositions = (
  user: string | undefined,
  chainId: SupportedNetworks,
  marketKey: string,
) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [position, setPosition] = useState<MarketPosition | null>(null);
  const [positionsError, setPositionsError] = useState<unknown | null>(null);

  const fetchData = useCallback(
    async (isRefetch = false, onSuccess?: () => void) => {
      if (!user) {
        console.error('Missing user address');
        setLoading(false);
        setIsRefetching(false);
        return;
      }

      try {
        if (isRefetch) {
          setIsRefetching(true);
        } else {
          setLoading(true);
        }

        setPositionsError(null);

        // Fetch position data from both networks
        const res = await fetch(URLS.MORPHO_BLUE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: userPositionForMarketQuery,
            variables: {
              address: user.toLowerCase(),
              chainId: chainId,
              marketKey,
            },
          }),
        });

        const data = (await res.json()) as { data: { marketPosition: MarketPosition } };

        setPosition(data.data.marketPosition);
        onSuccess?.();
      } catch (err) {
        console.error('Error fetching positions:', err);
        setPositionsError(err);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [user, chainId, marketKey],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    position,
    loading,
    isRefetching,
    positionsError,
    refetch: (onSuccess?: () => void) => void fetchData(true, onSuccess),
  };
};

export default useUserPositions;
