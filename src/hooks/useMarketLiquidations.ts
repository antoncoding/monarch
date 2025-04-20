import { useState, useEffect, useCallback } from 'react';
import { marketLiquidationsQuery } from '@/graphql/morpho-api-queries';
import { URLS } from '@/utils/urls';

export type MarketLiquidationTransaction = {
  hash: string;
  timestamp: number;
  type: string;
  data: {
    repaidAssets: string;
    seizedAssets: string;
    liquidator: string;
    badDebtAssets: string;
  };
};

/**
 * Hook to fetch all liquidations for a specific market
 * @param marketUniqueKey The unique key of the market
 * @returns List of all liquidation transactions for the market
 */
const useMarketLiquidations = (marketUniqueKey: string | undefined) => {
  const [liquidations, setLiquidations] = useState<MarketLiquidationTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiquidations = useCallback(async () => {
    if (!marketUniqueKey) {
      setLiquidations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const variables = {
        uniqueKey: marketUniqueKey,
      };

      const response = await fetch(`${URLS.MORPHO_BLUE_API}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: marketLiquidationsQuery,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch market liquidations');
      }

      const result = (await response.json()) as {
        data: { transactions: { items: MarketLiquidationTransaction[] } };
      };

      if (result.data?.transactions?.items) {
        setLiquidations(result.data.transactions.items);
      } else {
        setLiquidations([]);
      }
    } catch (err) {
      console.error('Error fetching market liquidations:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [marketUniqueKey]);

  useEffect(() => {
    void fetchLiquidations();
  }, [fetchLiquidations]);

  return {
    liquidations,
    loading,
    error,
  };
};

export default useMarketLiquidations;
