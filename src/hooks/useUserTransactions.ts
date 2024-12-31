import { useState, useCallback } from 'react';
import { userTransactionsQuery } from '@/graphql/queries';
import { UserTransaction } from '@/utils/types';
import { URLS } from '@/utils/urls';
import { SupportedNetworks } from '@/utils/networks';

export type TransactionFilters = {
  userAddress?: string[];
  marketUniqueKeys?: string[];
  chainIds?: number[];
  timestampGte?: number;
  timestampLte?: number;
  skip?: number;
  first?: number;
};

export type TransactionResponse = {
  items: UserTransaction[];
  pageInfo: {
    count: number;
    countTotal: number;
  };
};

const useUserTransactions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  const fetchTransactions = useCallback(
    async (filters: TransactionFilters): Promise<TransactionResponse | null> => {
      if (!filters.userAddress?.length) {
        console.error('Missing user address');
        return null;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(URLS.MORPHO_BLUE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: userTransactionsQuery,
            variables: {
              where: {
                userAddress_in: filters.userAddress,
                marketUniqueKey_in: filters.marketUniqueKeys ?? null,
                chainId_in: filters.chainIds ?? [SupportedNetworks.Base, SupportedNetworks.Mainnet],
                timestamp_gte: filters.timestampGte ?? null,
                timestamp_lte: filters.timestampLte ?? null,
              },
              first: filters.first ?? 1000,
              skip: filters.skip ?? 0,
            },
          }),
        });

        const result = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return result.data.transactions as TransactionResponse;
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    fetchTransactions,
  };
};

export default useUserTransactions;
