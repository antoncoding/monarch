/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { userPositionsQuery, useHistoryQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition, UserTransaction } from '@/utils/types';
import { URLS } from '@/utils/urls';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

const useUserPositions = (user: string | undefined, showEmpty = false) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [positionsError, setPositionsError] = useState<unknown | null>(null);
  const [historyError, setHistoryError] = useState<unknown | null>(null);

  const fetchData = useCallback(
    async (isRefetch = false) => {
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

        // Reset errors at the start of a new fetch
        setPositionsError(null);
        setHistoryError(null);

        // Fetch position data from both networks
        let marketPositions: MarketPosition[] = [];
        try {
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
        } catch (err) {
          console.error('Error fetching positions:', err);
          setPositionsError(err);
        }

        // Fetch history data from both networks
        try {
          const [historyMainnet, historyBase] = await Promise.all([
            fetch(URLS.MORPHO_BLUE_API, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: useHistoryQuery,
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
                query: useHistoryQuery,
                variables: {
                  address: user.toLowerCase(),
                  chainId: SupportedNetworks.Base,
                },
              }),
            }),
          ]);

          const historyResult1 = await historyMainnet.json();
          const historyResult2 = await historyBase.json();

          console.log('historyResult2', historyResult2)

          const transactions: UserTransaction[] = [];

          // Collect transactions
          for (const result of [historyResult1, historyResult2]) {
            if (result.data?.userByAddress) {
              const parsableTxs = (
                result.data.userByAddress.transactions as UserTransaction[]
              ).filter((t) => t.data?.market);
              transactions.push(...parsableTxs);
            }
          }

          // Sort transactions by timestamp (newest first)
          transactions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
          setHistory(transactions);
        } catch (err) {
          console.error('Error fetching history:', err);
          setHistoryError(err);
        }
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
    history,
    loading,
    isRefetching,
    positionsError,
    historyError,
    refetch: () => void fetchData(true),
  };
};

export default useUserPositions;
