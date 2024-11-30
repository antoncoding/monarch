/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { userPositionsQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition, UserTransaction } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

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
  balance: string;
  deposits: {
    amount: string;
    id: string;
    timestamp: string;
  }[];
  withdraws: {
    amount: string;
    timestamp: string;
  }[];
  side: 'SUPPLIER' | 'BORROWER';
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

const useUserPositions = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const calculatePositionDetails = (detailedPosition: DetailedPosition, supplyAssets: string) => {
    // Calculate total deposits
    const totalDeposits = detailedPosition.deposits.reduce(
      (sum, deposit) => sum + BigInt(deposit.amount),
      0n
    );

    // Calculate total withdraws
    const totalWithdraws = detailedPosition.withdraws.reduce(
      (sum, withdraw) => sum + BigInt(withdraw.amount),
      0n
    );

    // Current balance from the position
    const currentBalance = BigInt(supplyAssets);

    // Calculate earned interest (current balance - (deposits - withdraws))
    const netPrincipal = totalDeposits - totalWithdraws;
    const earned = currentBalance > netPrincipal ? currentBalance - netPrincipal : 0n;

    return {
      principal: netPrincipal.toString(),
      earned: earned.toString(),
      deposits: detailedPosition.deposits,
      balance: detailedPosition.balance,
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
          .map((position: MarketPosition) => {
            const detailedPosition = allDetailedPositions.find(
              (dp) => dp.market.id === position.market.uniqueKey,
            );

            console.log('User position, \n', position, '\n detailed position',  detailedPosition, '\n ------------------------'); 

            const totalDeposits = detailedPosition?.deposits.reduce(
              (sum: bigint, deposit: PositionDeposit) => sum + BigInt(deposit.amount),
              0n
            );

            const totalWithdraws = detailedPosition?.withdraws.reduce(
              (sum: bigint, withdraw: PositionWithdraw) => sum + BigInt(withdraw.amount),
              0n
            );

            console.log('totalDeposits', totalDeposits);
            console.log('totalWithdraws', totalWithdraws);

            const netPrincipal = totalDeposits - totalWithdraws;
            const currentBalance = BigInt(position.supplyAssets);

            const enhanced: MarketPosition = {
              ...position,
              market: {
                ...position.market,
                warningsWithDetail: getMarketWarningsWithDetail(position.market),
              },
            };

            if (detailedPosition) {
              const details = calculatePositionDetails(detailedPosition, position.supplyAssets);
              enhanced.principal = details.principal;
              enhanced.earned = details.earned;
              enhanced.deposits = details.deposits;
            } else {
              console.log('No detailed position found for market', position.market.uniqueKey);
            }

            return enhanced;
          });

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
