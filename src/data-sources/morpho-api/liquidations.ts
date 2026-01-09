/**
 * @deprecated_after_monarch_api_stable
 * This fetcher is kept as a fallback while Monarch Metrics API is being validated.
 * Used by useLiquidationsQuery.ts which is also deprecated.
 *
 * Once the Monarch API is confirmed stable, this file can be removed.
 * See useLiquidationsQuery.ts for the full list of related files.
 */
import type { SupportedNetworks } from '@/utils/networks';
import { URLS } from '@/utils/urls';

const liquidationsQuery = `
  query getLiquidations($first: Int, $skip: Int, $chainId: Int!) {
    transactions(
      where: { type_in: [MarketLiquidation], chainId_in: [$chainId] }
      first: $first
      skip: $skip
    ) {
      items {
        data {
          ... on MarketLiquidationTransactionData {
            market {
              uniqueKey
            }
          }
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

type LiquidationTransactionItem = {
  data: {
    market?: {
      uniqueKey: string;
    };
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
      items: LiquidationTransactionItem[];
      pageInfo: PageInfo;
    };
  };
  errors?: any[]; // Add optional errors field
};

export const fetchMorphoApiLiquidatedMarketKeys = async (network: SupportedNetworks): Promise<Set<string>> => {
  const liquidatedKeys = new Set<string>();
  let skip = 0;
  const pageSize = 1000;
  let totalCount = 0;

  try {
    do {
      const response = await fetch(URLS.MORPHO_BLUE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: liquidationsQuery,
          variables: { first: pageSize, skip, chainId: network }, // Pass chainId
        }),
      });

      if (!response.ok) {
        throw new Error(`Morpho API request failed with status ${response.status}`);
      }

      const result = (await response.json()) as QueryResult;

      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        throw new Error(`GraphQL error fetching liquidations for network ${network}`);
      }

      if (!result.data?.transactions) {
        console.warn(`No transactions data found for network ${network} at skip ${skip}`);
        break;
      }

      const { items, pageInfo } = result.data.transactions;

      for (const tx of items) {
        if (tx.data?.market?.uniqueKey) {
          liquidatedKeys.add(tx.data.market.uniqueKey);
        }
      }

      totalCount = pageInfo.countTotal;
      skip += pageInfo.count;

      if (pageInfo.count === 0 && skip < totalCount) break;
    } while (skip < totalCount);
  } catch (error) {
    console.error(`Error fetching liquidations via Morpho API for network ${network}:`, error);
    throw error;
  }

  console.log(`[Morpho API] Fetched ${liquidatedKeys.size} liquidated market keys for ${network}`);
  return liquidatedKeys;
};
