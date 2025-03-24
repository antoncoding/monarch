import { useState, useEffect, useCallback } from 'react';
import { marketSuppliesQuery } from '@/graphql/queries';
import { URLS } from '@/utils/urls';

export type MarketSupplyTransaction = {
  type: 'MarketSupply' | 'MarketWithdraw';
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
 * Hook to fetch all supply and withdraw activities for a specific market
 * @param marketUniqueKey The unique key of the market
 * @returns List of all supply and withdraw transactions for the market
 */
const useMarketSupplies = (marketUniqueKey: string | undefined) => {
  const [supplies, setSupplies] = useState<MarketSupplyTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSupplies = useCallback(async () => {
    if (!marketUniqueKey) {
      setSupplies([]);
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
          query: marketSuppliesQuery,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch market supplies');
      }

      const result = (await response.json()) as {
        data: { transactions: { items: MarketSupplyTransaction[] } };
      };

      if (result.data?.transactions?.items) {
        setSupplies(result.data.transactions.items);
      } else {
        setSupplies([]);
      }
    } catch (err) {
      console.error('Error fetching market supplies:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [marketUniqueKey]);

  useEffect(() => {
    void fetchSupplies();
  }, [fetchSupplies]);

  return {
    supplies,
    loading,
    error,
  };
};

export default useMarketSupplies;
