/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { userPositionsQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition, UserTransaction } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

const useUserPositions = (user: string | undefined, showEmpty = false) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [error, setError] = useState<unknown | null>(null);

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

        // Fetch position data from both networks
        const [responseMainnet, responseBase] = await Promise.all([
          fetch('https://blue-api.morpho.org/graphql', {
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
          fetch('https://blue-api.morpho.org/graphql', {
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
        const transactions: UserTransaction[] = [];

        // Collect positions and transactions
        for (const result of [result1, result2]) {
          if (result.data?.userByAddress) {
            marketPositions.push(
              ...(result.data.userByAddress.marketPositions as MarketPosition[]),
            );
            const parsableTxs = (
              result.data.userByAddress.transactions as UserTransaction[]
            ).filter((t) => t.data?.market);
            transactions.push(...parsableTxs);
          }
        }

        // Sort transactions by timestamp (newest first)
        transactions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

        // Process positions and calculate earnings
        const enhancedPositions = await Promise.all(
          marketPositions
            .filter((position: MarketPosition) => showEmpty || position.supplyShares.toString() !== '0')
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

        setHistory(transactions);
        setData(enhancedPositions);
      } catch (_error) {
        console.error('Error fetching positions:', _error);
        setError(_error);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [user, showEmpty],
  );

  useEffect(() => {
    fetchData().catch(console.error);
  }, [fetchData]);

  const refetch = useCallback(
    (onSuccess?: () => void) => {
      fetchData(true).then(onSuccess).catch(console.error);
    },
    [fetchData],
  );

  return { loading, isRefetching, data, history, error, refetch };
};

export default useUserPositions;
