/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { userPositionsQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition, UserTransaction } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { Address } from 'viem';
import { usePositionSnapshot, PositionSnapshot } from './usePositionSnapshot';

// Add API key constant
const THEGRAPH_API_KEY = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;
console.log('THEGRAPH_API_KEY', THEGRAPH_API_KEY)

// Add URL constants
const SUBGRAPH_URLS = {
  [SupportedNetworks.Base]: `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs`,
  [SupportedNetworks.Mainnet]: `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs`,
};

// Add new types for the detailed position data
type PositionDeposit = {
  amount: string;
  id: string;
  timestamp: string;
};

type PositionWithdraw = {
  amount: string;
  id: string;
  timestamp: string;
};


type DetailedPosition = {
  id: string;
  market: {
    id: string;
  };
  deposits: PositionDeposit[];
  withdraws: PositionWithdraw[];
  side: 'SUPPLIER' | 'BORROWER';
  realizedEarnings?: string;
};

const detailedPositionsQuery = `
  query getDetailedPositions($address: String!, $chainId: Int) {
    positions(where: {
      account_in: [$address]
      side_in: [SUPPLIER]
    }) {
      id
      side
      market {
        id
      }
      deposits {
        amount
        timestamp
        id
      }
      withdraws {
        amount
        timestamp
        id
      }
      balance
    }
  }
`;

interface PositionEarnings {
  lifetimeEarned: string;
  last24hEarned: string;
  last7dEarned: string;
  last30dEarned: string;
}

interface PositionDetails {
  earned: PositionEarnings;
  deposits: PositionDeposit[];
  withdraws: PositionWithdraw[];
}

const useUserPositions = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const { fetchPositionSnapshot } = usePositionSnapshot();

  const calculatePositionDetails = async (
    detailedPosition: DetailedPosition,
    supplyAssets: string,
    marketId: string,
    userAddress: Address,
    chainId: number
  ) => {

    // Calculate total deposits and withdraws
    const totalDeposits = detailedPosition.deposits.reduce(
      (sum: bigint, deposit: PositionDeposit) => sum + BigInt(deposit.amount),
      0n
    );

    const totalWithdraws = detailedPosition.withdraws.reduce(
      (sum: bigint, withdraw: PositionWithdraw) => sum + BigInt(withdraw.amount),
      0n
    );

    // Current balance from the position
    const currentBalance = BigInt(supplyAssets);
  
    // Calculate lifetime earnings (current balance + total withdraws) - (total deposits)
    const lifetimeEarned = currentBalance + totalWithdraws - totalDeposits;

    // Get historical snapshots
    const now = Math.floor(Date.now() / 1000);
    const snapshots = await Promise.all([
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 24 * 60 * 60),     // 24h ago
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 7 * 24 * 60 * 60), // 7d ago
      fetchPositionSnapshot(marketId, userAddress, chainId, now - 30 * 24 * 60 * 60) // 30d ago
    ]);

    // Calculate earnings for each period
    const [snapshot24h, snapshot7d, snapshot30d] = snapshots;

    const calculateEarningsFromSnapshot = (snapshot: PositionSnapshot | null) => {
      if (!snapshot) return '0';
      const snapshotBalance = BigInt(snapshot.supplyAssets);
      const depositsAfterSnapshot = detailedPosition.deposits
        .filter(d => Number(d.timestamp) > snapshot.timestamp)
        .reduce((sum, d) => sum + BigInt(d.amount), 0n);
      const withdrawsAfterSnapshot = detailedPosition.withdraws
        .filter(w => Number(w.timestamp) > snapshot.timestamp)
        .reduce((sum, w) => sum + BigInt(w.amount), 0n);
    
      const earned = (currentBalance + withdrawsAfterSnapshot) - (snapshotBalance + depositsAfterSnapshot);
      return earned.toString();
    };

    return {
      earned: {
        lifetimeEarned: lifetimeEarned.toString(),
        last24hEarned: calculateEarningsFromSnapshot(snapshot24h),
        last7dEarned: calculateEarningsFromSnapshot(snapshot7d),
        last30dEarned: calculateEarningsFromSnapshot(snapshot30d)
      },
      deposits: detailedPosition.deposits,
      withdraws: detailedPosition.withdraws,
    };
  };

  const fetchDetailedPositions = async (address: string, chainId: number) => {
    const subgraphUrl = SUBGRAPH_URLS[chainId as SupportedNetworks];
    if (!subgraphUrl) {
      console.error(`No subgraph URL for chain ID ${chainId}`);
      return [];
    }

    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: detailedPositionsQuery,
        variables: {
          address: address.toLowerCase(),
          chainId,
        },
      }),
    });

    const result = await response.json();

    // Check for errors in the response
    if (result.errors) {
      console.error('Subgraph query errors:', result.errors);
      return [];
    }
    
    return result.data?.positions ?? [];
  };

  const fetchData = useCallback(
    async (isRefetch = false) => {
      if (!user || !THEGRAPH_API_KEY) {
        console.error('Missing user address or API key');
        return;
      }

      try {
        if (isRefetch) {
          setIsRefetching(true);
        } else {
          setLoading(true);
        }

        // Fetch basic position data
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

        // Fetch detailed position data with new URLs
        const [detailedMainnet, detailedBase] = await Promise.all([
          fetchDetailedPositions(user, SupportedNetworks.Mainnet),
          fetchDetailedPositions(user, SupportedNetworks.Base),
        ]);

        const result1 = await responseMainnet.json();
        const result2 = await responseBase.json();

        const marketPositions: MarketPosition[] = [];
        const transactions: UserTransaction[] = [];

        // Combine all detailed positions
        const allDetailedPositions = [...detailedMainnet, ...detailedBase];

        for (const result of [result1, result2]) {
          if (result.data?.userByAddress) {
            marketPositions.push(...(result.data.userByAddress.marketPositions as MarketPosition[]));
            const parsableTxs = (result.data.userByAddress.transactions as UserTransaction[]).filter(
              (t) => t.data?.market,
            );
            transactions.push(...parsableTxs);
          }
        }

        // Enhance market positions with detailed data
        const enhancedPositions = marketPositions
          .filter((position: MarketPosition) => position.supplyShares.toString() !== '0')
          .map(async (position: MarketPosition) => {
            const detailedPosition = allDetailedPositions.find(
              (dp) => dp.market.id === position.market.uniqueKey,
            );

            if (detailedPosition) {
              console.log('market', position.market.loanAsset.symbol, '-', position.market.collateralAsset.symbol);
              const details = await calculatePositionDetails(
                detailedPosition, position.supplyAssets, position.market.uniqueKey, user as Address, position.market.morphoBlue.chain.id);
              return {
                ...position,
                market: {
                  ...position.market,
                  warningsWithDetail: getMarketWarningsWithDetail(position.market),
                },
                earned: details.earned,
                deposits: details.deposits,
                withdraws: details.withdraws,
              };
            } else {
              console.log('No detailed position found for market', position.market.uniqueKey);
              return position;
            }
          });

        const resolvedPositions = await Promise.all(enhancedPositions);

        setHistory(transactions);
        setData(resolvedPositions);
      } catch (_error) {
        console.error('Error fetching positions:', _error);
        setError(_error);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [user],
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
