import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoTransactions } from '@/data-sources/morpho-api/transactions';
import { fetchSubgraphTransactions } from '@/data-sources/subgraph/transactions';
import { SupportedNetworks, isSupportedChain } from '@/utils/networks';
import type { UserTransaction } from '@/utils/types';

export type TransactionFilters = {
  userAddress: string[];
  marketUniqueKeys?: string[];
  chainIds?: number[];
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
    count: number;
    countTotal: number;
  };
  error: string | null;
};

const MAX_ITEMS_PER_SOURCE = 1000;

/**
 * Standalone function to fetch user transactions from Morpho API or Subgraph.
 * Can be used imperatively in hooks that need to fetch transactions as part of a larger operation.
 *
 * @param filters - Transaction filters
 * @returns Promise resolving to transaction response
 */
export async function fetchUserTransactions(filters: TransactionFilters): Promise<TransactionResponse> {
  // 1. Determine target networks (numeric enum values)
  let targetNetworks: SupportedNetworks[];

  if (filters.chainIds && filters.chainIds.length > 0) {
    // Filter provided chainIds to only include valid, supported numeric values
    targetNetworks = filters.chainIds.filter(isSupportedChain) as SupportedNetworks[];
  } else {
    // Default to all supported networks (get only numeric values from enum)
    targetNetworks = Object.values(SupportedNetworks).filter((value) => typeof value === 'number') as SupportedNetworks[];
  }

  if (targetNetworks.length === 0) {
    console.warn('No valid target networks determined.');
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: null,
    };
  }

  // Check for subgraph user address limitation
  const usesSubgraph = targetNetworks.some((network) => !supportsMorphoApi(network));
  if (usesSubgraph && filters.userAddress.length !== 1) {
    const errorMsg = 'Subgraph data source requires exactly one user address.';
    console.error(errorMsg);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: errorMsg,
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
          // Single-chain: pass skip/first directly to API for proper pagination
          // Multi-chain: fetch MAX_ITEMS_PER_SOURCE to combine and sort across chains
          const isSingleChain = targetNetworks.length === 1;
          const morphoFilters = {
            ...filters,
            chainIds: [network],
            first: isSingleChain ? (filters.first ?? MAX_ITEMS_PER_SOURCE) : MAX_ITEMS_PER_SOURCE,
            skip: isSingleChain ? (filters.skip ?? 0) : 0,
          };
          const morphoResponse = await fetchMorphoTransactions(morphoFilters);
          if (!morphoResponse.error) {
            networkItems = morphoResponse.items;
            return {
              items: networkItems,
              pageInfo: {
                count: networkItems.length,
                countTotal: morphoResponse.pageInfo.countTotal,
              },
              error: null,
            };
          }
          networkError = morphoResponse.error;
        } catch (morphoError) {
          networkError = `Failed to fetch from Morpho API: ${(morphoError as Error)?.message || 'Unknown error'}`;
        }
      }

      // Only try Subgraph if Morpho API failed or is not supported
      if (!supportsMorphoApi(network) || networkError) {
        try {
          const subgraphFilters = {
            ...filters,
            chainIds: [network],
            first: MAX_ITEMS_PER_SOURCE,
            skip: 0,
          };
          const subgraphResponse = await fetchSubgraphTransactions(subgraphFilters, network);
          if (!subgraphResponse.error) {
            networkItems = subgraphResponse.items;
            return {
              items: networkItems,
              pageInfo: {
                count: networkItems.length,
                countTotal: networkItems.length,
              },
              error: null,
            };
          }
          networkError = subgraphResponse.error;
        } catch (subgraphError) {
          networkError = `Failed to fetch from Subgraph: ${(subgraphError as Error)?.message || 'Unknown error'}`;
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

  // 3. Combine results
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

  // 4. Sort combined results by timestamp
  combinedItems.sort((a, b) => b.timestamp - a.timestamp);

  // 5. For single-chain queries, API handles pagination; for multi-chain, no client-side slice needed
  // (multi-chain is only used for fetching all data, not paginated display)
  const paginatedItems = combinedItems;

  const finalError = errors.length > 0 ? errors.join('; ') : null;

  return {
    items: paginatedItems,
    pageInfo: {
      count: paginatedItems.length,
      countTotal: combinedTotalCount,
    },
    error: finalError,
  };
}
