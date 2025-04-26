import { userTransactionsQuery } from '@/graphql/morpho-api-queries';
import { TransactionFilters, TransactionResponse } from '@/hooks/useUserTransactions';
import { SupportedNetworks } from '@/utils/networks';
import { URLS } from '@/utils/urls';

export const fetchMorphoTransactions = async (
  filters: TransactionFilters,
): Promise<TransactionResponse> => {
  // Conditionally construct the 'where' object
  const whereClause: Record<string, any> = {
    userAddress_in: filters.userAddress, // Assuming this is always required
    // Default chainIds if none are provided in filters for Morpho API call context
    chainId_in: filters.chainIds ?? [SupportedNetworks.Base, SupportedNetworks.Mainnet],
  };

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
    const response = await fetch(URLS.MORPHO_BLUE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: userTransactionsQuery,
        variables: {
          where: whereClause, // Use the conditionally built 'where' clause
          first: filters.first ?? 1000,
          skip: filters.skip ?? 0,
        },
      }),
    });

    const result = (await response.json()) as {
      data?: { transactions?: TransactionResponse };
      errors?: { message: string }[];
    };

    if (result.errors) {
      throw new Error(result.errors.map((e) => e.message).join(', '));
    }

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
