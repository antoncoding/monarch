/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { userPositionsQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { fetchPositionSnapshot } from '@/utils/positions';
import { MarketPosition } from '@/utils/types';
import { URLS } from '@/utils/urls';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { useUserMarketsCache } from '../hooks/useUserMarketsCache';
import { useMarkets } from './useMarkets';

const useUserPositions = (user: string | undefined, showEmpty = false) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [positionsError, setPositionsError] = useState<unknown | null>(null);

  const { markets } = useMarkets();

  const { getUserMarkets, batchAddUserMarkets } = useUserMarketsCache();

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

        const unknownUsedMarkets = getUserMarkets();

        const marketPositions: MarketPosition[] = [];

        // Collect positions
        for (const result of [result1, result2]) {
          if (result.data?.userByAddress) {
            marketPositions.push(
              ...(result.data.userByAddress.marketPositions as MarketPosition[]),
            );
          }
        }

        for (const market of unknownUsedMarkets) {
          // check if they're already in the marketPositions array
          if (
            marketPositions.find(
              (position) =>
                position.market.uniqueKey.toLowerCase() === market.marketUniqueKey.toLowerCase() &&
                position.market.morphoBlue.chain.id === market.chainId,
            )
          ) {
            continue;
          }

          // skip markets we can't find
          const marketWithDetails = markets.find((m) => m.uniqueKey === market.marketUniqueKey);
          if (!marketWithDetails) {
            continue;
          }

          const currentSnapshot = await fetchPositionSnapshot(
            market.marketUniqueKey,
            user as Address,
            market.chainId,
            0,
          );

          if (currentSnapshot) {
            marketPositions.push({
              market: marketWithDetails,
              state: currentSnapshot,
            });
          }
        }

        const enhancedPositions = await Promise.all(
          marketPositions
            .filter(
              (position: MarketPosition) =>
                showEmpty || position.state.supplyShares.toString() !== '0',
            )
            .map(async (position: MarketPosition) => {
              // fetch real market position to be accurate
              const currentSnapshot = await fetchPositionSnapshot(
                position.market.uniqueKey,
                user as Address,
                position.market.morphoBlue.chain.id,
                0,
              );

              const accuratePositionState = currentSnapshot ? currentSnapshot : position.state;

              // Process positions and calculate earnings
              return {
                state: accuratePositionState,
                market: {
                  ...position.market,
                  warningsWithDetail: getMarketWarningsWithDetail(position.market),
                },
              };
            }),
        );

        setData(enhancedPositions);

        batchAddUserMarkets(
          marketPositions.map((position) => ({
            marketUniqueKey: position.market.uniqueKey,
            chainId: position.market.morphoBlue.chain.id,
          })),
        );

        onSuccess?.();
      } catch (err) {
        console.error('Error fetching positions:', err);
        setPositionsError(err);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [user, showEmpty, markets],
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
