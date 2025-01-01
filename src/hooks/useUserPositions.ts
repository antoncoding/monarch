/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { userPositionsQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition } from '@/utils/types';
import { URLS } from '@/utils/urls';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

const useUserPositions = (user: string | undefined, showEmpty = false) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
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
        const [responseMainnet, responseBase] = await Promise.all([
          fetch(URLS.MORPHO_BLUE_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: userPositionsQuery,
              variables: {
                address: user.toLowerCase(),
                chainId: SupportedNetworks.Mainnet,
              },
            }),
          }),
          fetch(URLS.MORPHO_BLUE_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: userPositionsQuery,
              variables: {
                address: user.toLowerCase(),
                chainId: SupportedNetworks.Base,
              },
            }),
          }),
        ]);

        const result1 = await responseMainnet.json();
        const result2 = await responseBase.json();

        const marketPositions: MarketPosition[] = [];

        // Collect positions
        for (const result of [result1, result2]) {
          if (result.data?.userByAddress) {
            marketPositions.push(
              ...(result.data.userByAddress.marketPositions as MarketPosition[]),
            );
          }
        }

        // Process positions and calculate earnings
        const enhancedPositions = await Promise.all(
          marketPositions
            .filter(
              (position: MarketPosition) => showEmpty || position.supplyShares.toString() !== '0',
            )
            .map(async (position: MarketPosition) => {
              return {
                ...position,
                market: {
                  ...position.market,
                  warningsWithDetail: getMarketWarningsWithDetail(position.market),
                },
              };
            }),
        );

        setData(enhancedPositions);
        onSuccess?.();
      } catch (err) {
        console.error('Error fetching positions:', err);
        setPositionsError(err);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [user, showEmpty],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    isRefetching,
    positionsError,
    refetch: (onSuccess?: () => void) => void fetchData(true, onSuccess),
  };
};

export default useUserPositions;
