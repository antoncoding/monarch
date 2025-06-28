import { useState, useCallback } from 'react';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoTransactions } from '@/data-sources/morpho-api/transactions';
import { fetchSubgraphTransactions } from '@/data-sources/subgraph/transactions';
import { SupportedNetworks, isSupportedChain } from '@/utils/networks';
import { UserTransaction } from '@/utils/types';

export type TransactionFilters = {
  userAddress: string[]; // Expecting only one for subgraph compatibility
  marketUniqueKeys?: string[]; // empty: all markets
  chainIds?: number[]; // Optional: If provided, fetch only from these chains
  timestampGte?: number;
  timestampLte?: number;
  skip?: number;
  first?: number;
  hash?: string;
  assetIds?: string[];
};

export type TransactionResponse = {
  items: UserTransaction[];
  pageInfo: {
    count: number; // Count of items *in the current page* after client-side pagination
    countTotal: number; // Estimated total count across all sources
  };
  error: string | null;
};

// Define a default limit for fetching from each source when combining
const MAX_ITEMS_PER_SOURCE = 1000;

const useUserTransactions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(
    async (filters: TransactionFilters): Promise<TransactionResponse> => {
      setLoading(true);
      setError(null);

      // 1. Determine target networks (numeric enum values)
      let targetNetworks: SupportedNetworks[];

      if (filters.chainIds && filters.chainIds.length > 0) {
        // Filter provided chainIds to only include valid, supported numeric values
        targetNetworks = filters.chainIds.filter(isSupportedChain) as SupportedNetworks[];
      } else {
        // Default to all supported networks (get only numeric values from enum)
        targetNetworks = Object.values(SupportedNetworks).filter(
          (value) => typeof value === 'number',
        ) as SupportedNetworks[];
      }

      if (targetNetworks.length === 0) {
        console.warn('No valid target networks determined.');
        setLoading(false);
        return { items: [], pageInfo: { count: 0, countTotal: 0 }, error: null };
      }

      // Check for subgraph user address limitation
      const usesSubgraph = targetNetworks.some((network) => !supportsMorphoApi(network));
      if (usesSubgraph && filters.userAddress.length !== 1) {
        console.error('Subgraph requires exactly one user address.');
        setError('Subgraph data source requires exactly one user address.');
        setLoading(false);
        return {
          items: [],
          pageInfo: { count: 0, countTotal: 0 },
          error: 'Subgraph data source requires exactly one user address.',
        };
      }

      // 2. Create fetch promises for each network
      const results = await Promise.allSettled(
        targetNetworks.map(async (network) => {
          let networkItems: UserTransaction[] = [];
          let networkError: string | null = null;

          // Try Morpho API first if supported
          if (supportsMorphoApi(network)) {
            try {
              console.log(`Attempting to fetch transactions via Morpho API for network ${network}`);
              const morphoFilters = {
                ...filters,
                chainIds: [network],
                first: MAX_ITEMS_PER_SOURCE,
                skip: 0,
              };
              const morphoResponse = await fetchMorphoTransactions(morphoFilters);
              if (!morphoResponse.error) {
                networkItems = morphoResponse.items;
                console.log(
                  `Received ${networkItems.length} items from Morpho API for network ${network}`,
                );
                return {
                  items: networkItems,
                  pageInfo: {
                    count: networkItems.length,
                    countTotal: networkItems.length,
                  },
                  error: null,
                };
              } else {
                networkError = morphoResponse.error;
                console.warn(`Error from Morpho API for network ${network}:`, networkError);
              }
            } catch (morphoError) {
              console.error(`Failed to fetch from Morpho API for network ${network}:`, morphoError);
              networkError = `Failed to fetch from Morpho API: ${
                (morphoError as Error)?.message || 'Unknown error'
              }`;
            }
          }

          // Only try Subgraph if Morpho API failed or is not supported
          if (!supportsMorphoApi(network) || networkError) {
            try {
              console.log(`Attempting to fetch transactions via Subgraph for network ${network}`);
              const subgraphFilters = {
                ...filters,
                chainIds: [network],
                first: MAX_ITEMS_PER_SOURCE,
                skip: 0,
              };
              const subgraphResponse = await fetchSubgraphTransactions(subgraphFilters, network);
              if (!subgraphResponse.error) {
                networkItems = subgraphResponse.items;
                console.log(
                  `Received ${networkItems.length} items from Subgraph for network ${network}`,
                );
                return {
                  items: networkItems,
                  pageInfo: {
                    count: networkItems.length,
                    countTotal: networkItems.length,
                  },
                  error: null,
                };
              } else {
                networkError = subgraphResponse.error;
                console.warn(`Error from Subgraph for network ${network}:`, networkError);
              }
            } catch (subgraphError) {
              console.error(`Failed to fetch from Subgraph for network ${network}:`, subgraphError);
              networkError = `Failed to fetch from Subgraph: ${
                (subgraphError as Error)?.message || 'Unknown error'
              }`;
            }
          }

          // Only reach here if both Morpho API and Subgraph failed
          return {
            items: networkItems,
            pageInfo: {
              count: networkItems.length,
              countTotal: networkItems.length,
            },
            error: networkError,
          };
        }),
      );

      // 4. Combine results
      let combinedItems: UserTransaction[] = [];
      let combinedTotalCount = 0;
      const errors: string[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const response = result.value;
          if (response.error) {
            errors.push(response.error);
          } else {
            combinedItems = combinedItems.concat(response.items);
            combinedTotalCount += response.pageInfo.countTotal;
          }
        } else {
          errors.push(`Failed to fetch transactions: ${result.reason?.message || 'Unknown error'}`);
        }
      });

      // 5. Sort combined results by timestamp
      combinedItems.sort((a, b) => b.timestamp - a.timestamp);

      // 6. Apply client-side pagination
      const skip = filters.skip ?? 0;
      const first = filters.first ?? combinedItems.length;
      const paginatedItems = combinedItems.slice(skip, skip + first);

      const finalError = errors.length > 0 ? errors.join('; ') : null;
      if (finalError) {
        setError(finalError);
      }

      setLoading(false);

      return {
        items: paginatedItems,
        pageInfo: {
          count: paginatedItems.length,
          countTotal: combinedTotalCount,
        },
        error: finalError,
      };
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
