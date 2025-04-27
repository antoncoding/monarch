import { useState, useCallback } from 'react';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoTransactions } from '@/data-sources/morpho-api/transactions';
import { fetchSubgraphTransactions } from '@/data-sources/subgraph/transactions';
import { SupportedNetworks, isSupportedChain } from '@/utils/networks';
import { UserTransaction } from '@/utils/types';

export type TransactionFilters = {
  userAddress: string[]; // Expecting only one for subgraph compatibility
  marketUniqueKeys?: string[];
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
      const usesSubgraph = targetNetworks.some(
        (network) => getMarketDataSource(network) === 'subgraph',
      );
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

      // 2. Categorize networks by data source (numeric enum values)
      const morphoNetworks: SupportedNetworks[] = [];
      const subgraphNetworks: SupportedNetworks[] = [];

      targetNetworks.forEach((network) => {
        // network is now guaranteed to be a numeric enum value (e.g., 1, 8453)
        if (getMarketDataSource(network) === 'subgraph') {
          subgraphNetworks.push(network);
        } else {
          morphoNetworks.push(network);
        }
      });

      // 3. Create fetch promises
      const fetchPromises: Promise<TransactionResponse>[] = [];

      console.log('morphoNetworks', morphoNetworks);

      // Morpho API Fetch
      if (morphoNetworks.length > 0) {
        // morphoNetworks directly contains the numeric chain IDs (e.g., [1, ...])
        console.log(`Queueing fetch from Morpho API for chain IDs: ${morphoNetworks.join(', ')}`);
        const morphoFilters = {
          ...filters,
          chainIds: morphoNetworks, // Pass the numeric IDs directly
          first: MAX_ITEMS_PER_SOURCE,
          skip: 0,
        };
        fetchPromises.push(fetchMorphoTransactions(morphoFilters));
      }

      // Subgraph Fetches
      subgraphNetworks.forEach((network) => {
        // network is the numeric enum value (e.g., 8453)
        console.log(`Queueing fetch from Subgraph for network ID: ${network}`);
        const subgraphFilters = {
          ...filters,
          chainIds: [network], // Pass the single numeric ID for context
          first: MAX_ITEMS_PER_SOURCE,
          skip: 0,
        };
        // Pass the enum value (which is the number) to fetchSubgraphTransactions
        fetchPromises.push(fetchSubgraphTransactions(subgraphFilters, network));
      });

      // 4. Execute promises in parallel
      const results = await Promise.allSettled(fetchPromises);

      // 5. Combine results
      let combinedItems: UserTransaction[] = [];
      let combinedTotalCount = 0;
      const errors: string[] = [];

      results.forEach((result, index) => {
        const networkDescription =
          index < (morphoNetworks.length > 0 ? 1 : 0)
            ? `Morpho API (${morphoNetworks.join(', ')})`
            : `Subgraph (${subgraphNetworks[index - (morphoNetworks.length > 0 ? 1 : 0)]})`; // Adjust index for subgraph networks

        if (result.status === 'fulfilled') {
          const response = result.value;
          if (response.error) {
            console.warn(`Error from ${networkDescription}: ${response.error}`);
            errors.push(`Error from ${networkDescription}: ${response.error}`);
          } else {
            combinedItems = combinedItems.concat(response.items);
            combinedTotalCount += response.pageInfo.countTotal; // Aggregate total count
            console.log(`Received ${response.items.length} items from ${networkDescription}`);
          }
        } else {
          console.error(`Failed to fetch from ${networkDescription}:`, result.reason);
          errors.push(
            `Failed to fetch from ${networkDescription}: ${
              result.reason?.message || 'Unknown error'
            }`,
          );
        }
      });

      // 6. Sort combined results by timestamp
      combinedItems.sort((a, b) => b.timestamp - a.timestamp);

      // 7. Apply client-side pagination
      const skip = filters.skip ?? 0;
      const first = filters.first ?? combinedItems.length; // Default to all items if 'first' is not provided
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
          countTotal: combinedTotalCount, // Note: This is an estimated total
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
