import { useState, useEffect, useCallback } from 'react';
import { marketBorrowsQuery } from '@/graphql/queries';
import { URLS } from '@/utils/urls';

export type MarketBorrowTransaction = {
  type: 'MarketBorrow' | 'MarketRepay';
  hash: string;
  timestamp: number;
  data: {
    assets: string;
    shares: string;
  };
  user: {
    address: string;
  };
};

/**
 * Hook to fetch all borrow and repay activities for a specific market
 * @param marketUniqueKey The unique key of the market
 * @returns List of all borrow and repay transactions for the market
 */
const useMarketBorrows = (marketUniqueKey: string | undefined) => {
  const [borrows, setBorrows] = useState<MarketBorrowTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBorrows = useCallback(async () => {
    if (!marketUniqueKey) {
      setBorrows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const variables = {
        uniqueKey: marketUniqueKey,
        first: 1000, // Limit to 100 most recent transactions
        skip: 0,
      };

      const response = await fetch(`${URLS.MORPHO_BLUE_API}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: marketBorrowsQuery,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch market borrows');
      }

      const result = (await response.json()) as {
        data: { transactions: { items: MarketBorrowTransaction[] } };
      };

      if (result.data?.transactions?.items) {
        setBorrows(result.data.transactions.items);
      } else {
        setBorrows([]);
      }
    } catch (err) {
      console.error('Error fetching market borrows:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [marketUniqueKey]);

  useEffect(() => {
    void fetchBorrows();
  }, [fetchBorrows]);

  return {
    borrows,
    loading,
    error,
  };
};

export default useMarketBorrows;
