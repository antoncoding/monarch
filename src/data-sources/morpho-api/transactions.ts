import { userTransactionsQuery } from '@/graphql/morpho-api-queries';
import { TransactionFilters, TransactionResponse } from '@/hooks/useUserTransactions';
import { SupportedNetworks } from '@/utils/networks';
import { morphoGraphqlFetcher } from './fetchers';

// Define the expected shape of the GraphQL response for transactions
type MorphoTransactionsApiResponse = {
  data?: {
    transactions?: TransactionResponse;
  };
  // errors are handled by the fetcher
};

export const fetchMorphoTransactions = async (
  filters: TransactionFilters,
): Promise<TransactionResponse> => {
  // Conditionally construct the 'where' object
  const whereClause: Record<string, any> = {
    userAddress_in: filters.userAddress, // Assuming this is always required
    // Default chainIds if none are provided in filters for Morpho API call context
    chainId_in: filters.chainIds ?? [SupportedNetworks.Base, SupportedNetworks.Mainnet],
  };

  // disable cuz it's too long
  if (filters.marketUniqueKeys && filters.marketUniqueKeys.length > 0) {
    whereClause.marketUniqueKey_in = filters.marketUniqueKeys;
  }
  if (filters.timestampGte !== undefined && filters.timestampGte !== null) {
    whereClause.timestamp_gte = filters.timestampGte;
  }
  if (filters.timestampLte !== undefined && filters.timestampLte !== null) {
    whereClause.timestamp_lte = filters.timestampLte;
  }
  if (filters.hash) {
    whereClause.hash = filters.hash;
  }
  if (filters.assetIds && filters.assetIds.length > 0) {
    whereClause.assetId_in = filters.assetIds;
  }

  try {
    const result = await morphoGraphqlFetcher<MorphoTransactionsApiResponse>(
      userTransactionsQuery,
      {
        where: whereClause,
        first: filters.first ?? 1000,
        skip: filters.skip ?? 0,
      },
    );

    const transactions = result.data?.transactions;
    if (!transactions) {
      return {
        items: [],
        pageInfo: { count: 0, countTotal: 0 },
        error: 'No transaction data received from Morpho API',
      };
    }

    return transactions;
  } catch (err) {
    console.error('Error fetching Morpho API transactions:', err);
    return {
      items: [],
      pageInfo: { count: 0, countTotal: 0 },
      error: err instanceof Error ? err.message : 'Unknown Morpho API error occurred',
    };
  }
};
