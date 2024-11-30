/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { userPositionsQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition, UserTransaction, UserTxTypes } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { usePositionSnapshot, PositionSnapshot } from './usePositionSnapshot';

export type PositionEarnings = {
  lifetimeEarned: string;
  last24hEarned: string;
  last7dEarned: string;
  last30dEarned: string;
}

const useUserPositions = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const { fetchPositionSnapshot } = usePositionSnapshot();

  const calculatePositionEarnings = async (
    position: MarketPosition,
    transactions: UserTransaction[],
    userAddress: Address,
    chainId: number
  ) => {
    const currentBalance = BigInt(position.supplyAssets);
    const marketId = position.market.uniqueKey;

    // Filter transactions for this specific market
    const marketTxs = transactions.filter(tx => 
      tx.data?.market?.uniqueKey === marketId
    );

    // Calculate lifetime earnings using all transactions
    const totalDeposits = marketTxs
      .filter(tx => tx.type === UserTxTypes.MarketSupply)
      .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);

    const totalWithdraws = marketTxs
      .filter(tx => tx.type === UserTxTypes.MarketWithdraw)
      .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);

    const lifetimeEarned = currentBalance + totalWithdraws - totalDeposits;

    // Get historical snapshots
    const now = Math.floor(Date.now() / 1000);
    const snapshots = await Promise.all([
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 24 * 60 * 60),     // 24h ago
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 7 * 24 * 60 * 60), // 7d ago
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 30 * 24 * 60 * 60) // 30d ago
    ]);

    const calculateEarningsFromSnapshot = (snapshot: PositionSnapshot | null, timestamp: number) => {
      if (!snapshot) return '0';

      const snapshotBalance = BigInt(snapshot.supplyAssets);
      
      // Get transactions after snapshot timestamp
      const txsAfterSnapshot = marketTxs.filter(tx => Number(tx.timestamp) > timestamp);
      
      const depositsAfter = txsAfterSnapshot
        .filter(tx => tx.type === UserTxTypes.MarketSupply)
        .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);

      const withdrawsAfter = txsAfterSnapshot
        .filter(tx => tx.type === UserTxTypes.MarketWithdraw)
        .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);
    
      const earned = (currentBalance + withdrawsAfter) - (snapshotBalance + depositsAfter);

      if (earned < 0n) {
        console.log('Negative earnings detected:', {
          currentBalance: currentBalance.toString(),
          snapshotBalance: snapshotBalance.toString(),
          depositsAfter: depositsAfter.toString(),
          withdrawsAfter: withdrawsAfter.toString(),
          earned: earned.toString(),
          timestamp,
          marketId
        });
      }

      return earned.toString();
    };

    const [snapshot24h, snapshot7d, snapshot30d] = snapshots;
    
    return {
      lifetimeEarned: lifetimeEarned.toString(),
      last24hEarned: calculateEarningsFromSnapshot(snapshot24h, now - 24 * 60 * 60),
      last7dEarned: calculateEarningsFromSnapshot(snapshot7d, now - 7 * 24 * 60 * 60),
      last30dEarned: calculateEarningsFromSnapshot(snapshot30d, now - 30 * 24 * 60 * 60)
    };
  };

  const fetchData = useCallback(
    async (isRefetch = false) => {
      if (!user) {
        console.error('Missing user address');
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
            marketPositions.push(...(result.data.userByAddress.marketPositions as MarketPosition[]));
            const parsableTxs = (result.data.userByAddress.transactions as UserTransaction[]).filter(
              (t) => t.data?.market,
            );
            transactions.push(...parsableTxs);
          }
        }

        // Sort transactions by timestamp (newest first)
        transactions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

        // Process positions and calculate earnings
        const enhancedPositions = await Promise.all(
          marketPositions
            .filter((position: MarketPosition) => position.supplyShares.toString() !== '0')
            .map(async (position: MarketPosition) => {
              const earnings = await calculatePositionEarnings(
                position,
                transactions,
                user as Address,
                position.market.morphoBlue.chain.id
              );

              return {
                ...position,
                market: {
                  ...position.market,
                  warningsWithDetail: getMarketWarningsWithDetail(position.market),
                },
                earned: earnings
              };
            })
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
    [user, fetchPositionSnapshot],
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
