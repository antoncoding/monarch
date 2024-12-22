import { useState, useEffect, useCallback } from 'react';
import { URLS } from '@/utils/urls';

const liquidationsQuery = `
  query getLiquidations($first: Int, $skip: Int) {
    transactions(
      where: { type_in: [MarketLiquidation] }
      first: $first
      skip: $skip
    ) {
      items {
        id
        type
        data {
          ... on MarketLiquidationTransactionData {
            market {
              id
              uniqueKey
            }
            repaidAssets
          }
        }
        hash
        chain {
          id
        }
      }
      pageInfo {
        countTotal
        count
        limit
        skip
      }
    }
  }
`;

export type LiquidationTransaction = {
  id: string;
  type: string;
  data: {
    market: {
      id: string;
      uniqueKey: string;
    };
    repaidAssets: string;
  };
  hash: string;
  chain: {
    id: number;
  };
};

type PageInfo = {
  countTotal: number;
  count: number;
  limit: number;
  skip: number;
};

type QueryResult = {
  data: {
    transactions: {
      items: LiquidationTransaction[];
      pageInfo: PageInfo;
    };
  };
};

const useLiquidations = () => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [liquidatedMarketIds, setLiquidatedMarketIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<unknown | null>(null);

  const fetchLiquidations = useCallback(async (isRefetch = false) => {
    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setLoading(true);
      }
      const liquidatedIds = new Set<string>();
      let skip = 0;
      const pageSize = 1000;
      let totalCount = 0;

      do {
        const response = await fetch(URLS.MORPHO_BLUE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: liquidationsQuery,
            variables: { first: pageSize, skip },
          }),
        });
        const result = (await response.json()) as QueryResult;
        const liquidations = result.data.transactions.items;
        const pageInfo = result.data.transactions.pageInfo;

        liquidations.forEach((tx) => {
          if (tx.data && 'market' in tx.data) {
            liquidatedIds.add(tx.data.market.id);
          }
        });

        totalCount = pageInfo.countTotal;
        skip += pageInfo.count;
      } while (skip < totalCount);

      setLiquidatedMarketIds(liquidatedIds);
    } catch (_error) {
      setError(_error);
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, []);

  useEffect(() => {
    fetchLiquidations().catch(console.error);
  }, [fetchLiquidations]);

  const refetch = useCallback(() => {
    fetchLiquidations(true).catch(console.error);
  }, [fetchLiquidations]);

  return { loading, isRefetching, liquidatedMarketIds, error, refetch };
};

export default useLiquidations;
