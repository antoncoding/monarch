import { SupportedNetworks } from '@/utils/networks';
import { URLS } from '@/utils/urls';

// Re-use the query structure from the original hook
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

export const fetchMorphoApiLiquidatedMarketKeys = async (
  network: SupportedNetworks,
): Promise<Set<string>> => {
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

      // Check for GraphQL errors
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        throw new Error(`GraphQL error fetching liquidations for network ${network}`);
      }

      if (!result.data?.transactions) {
        console.warn(`No transactions data found for network ${network} at skip ${skip}`);
        break; // Exit loop if data structure is unexpected
      }

      const liquidations = result.data.transactions.items;
      const pageInfo = result.data.transactions.pageInfo;

      liquidations.forEach((tx) => {
        if (tx.data?.market?.uniqueKey) {
          liquidatedKeys.add(tx.data.market.uniqueKey);
        }
      });

      totalCount = pageInfo.countTotal;
      skip += pageInfo.count;

      // Safety break if pageInfo.count is 0 to prevent infinite loop
      if (pageInfo.count === 0 && skip < totalCount) {
        console.warn('Received 0 items in a page, but not yet at total count. Breaking loop.');
        break;
      }
    } while (skip < totalCount);
  } catch (error) {
    console.error(`Error fetching liquidations via Morpho API for network ${network}:`, error);
    throw error; // Re-throw the error to be handled by the calling hook
  }

  console.log(
    `Fetched ${liquidatedKeys.size} liquidated market keys via Morpho API for ${network}.`,
  );
  return liquidatedKeys;
};
