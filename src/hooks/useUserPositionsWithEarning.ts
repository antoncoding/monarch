/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { MarketPosition, MarketPositionWithEarnings, UserTransaction } from '@/utils/types';
import { calculateEarningsFromSnapshot } from '@/utils/interest';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { usePositionSnapshot } from './usePositionSnapshot';
import useUserPositions from './useUserPositions';

/**
 * @dev get position + 1day, 1week, 1month interest earning data
 */
const useUserPositionsWithEarning = (user: string | undefined, showEmpty = false) => {
  
  const [data, setData] = useState<MarketPositionWithEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: marketPositions, history: transactions, loading: loadingPositions, refetch, isRefetching } = useUserPositions(user, showEmpty);

  const { fetchPositionSnapshot } = usePositionSnapshot();

  const calculateEarningsFromPeriod = async (
    position: MarketPosition,
    transactions: UserTransaction[],
    userAddress: Address,
    chainId: number,
  ) => {
    const currentBalance = BigInt(position.supplyAssets);
    const marketId = position.market.uniqueKey;

    // Filter transactions for this specific market
    const marketTxs = transactions.filter((tx) => tx.data?.market?.uniqueKey === marketId);

    // Get historical snapshots
    const now = Math.floor(Date.now() / 1000);
    const snapshots = await Promise.all([
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 24 * 60 * 60), // 24h ago
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 7 * 24 * 60 * 60), // 7d ago
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 30 * 24 * 60 * 60), // 30d ago
    ]);

    const [snapshot24h, snapshot7d, snapshot30d] = snapshots;

    return {
      lifetimeEarned: calculateEarningsFromSnapshot(
        currentBalance,
        0n, // genesis snapshot: 0 balance
        marketTxs,
        0,
      ),
      last24hEarned: snapshot24h
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot24h.supplyAssets),
            marketTxs,
            now - 24 * 60 * 60,
          )
        : null,
      last7dEarned: snapshot7d
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot7d.supplyAssets),
            marketTxs,
            now - 7 * 24 * 60 * 60,
          )
        : null,
      last30dEarned: snapshot30d
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot30d.supplyAssets),
            marketTxs,
            now - 30 * 24 * 60 * 60,
          )
        : null,
    };
  };

  const calculateAndAppendEarnings = useCallback(
    async (positions: MarketPosition[]) => {
      const enhancedPositions = await Promise.all(
        positions
          .filter((position: MarketPosition) => showEmpty || position.supplyShares.toString() !== '0')
          .map(async (position: MarketPosition) => {
            const earnings = await calculateEarningsFromPeriod(
              position,
              transactions,
              user as Address,
              position.market.morphoBlue.chain.id,
            );

            return {
              ...position,
              market: {
                ...position.market,
                warningsWithDetail: getMarketWarningsWithDetail(position.market),
              },
              earned: earnings,
            };
          }),
      );
      return enhancedPositions;
    },
    [transactions, user, showEmpty],
  );

  // calculate earnings and attach to positions
  useEffect(() => {
    const addEarning = async () => {
      setLoading(true);
      const enhancedPositions = await calculateAndAppendEarnings(marketPositions);
      setData(enhancedPositions);
      setLoading(false);
    };

    addEarning();

  }, [marketPositions]);

  return { loading: loading || loadingPositions, calculateEarningsFromPeriod, data, refetch, isRefetching };
};

export default useUserPositionsWithEarning;
