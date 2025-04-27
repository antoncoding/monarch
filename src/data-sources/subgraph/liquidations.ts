import { subgraphMarketsWithLiquidationCheckQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { blacklistTokens } from '@/utils/tokens';
import { subgraphGraphqlFetcher } from './fetchers';

// Define the expected structure of the response for the liquidation check query
type SubgraphMarketLiquidationCheck = {
  id: string; // Market unique key
  liquidates: { id: string }[]; // Array will be non-empty if liquidations exist
};

type SubgraphMarketsLiquidationCheckResponse = {
  data: {
    markets: SubgraphMarketLiquidationCheck[];
  };
  errors?: any[];
};

export const fetchSubgraphLiquidatedMarketKeys = async (
  network: SupportedNetworks,
): Promise<Set<string>> => {
  const subgraphApiUrl = getSubgraphUrl(network);
  if (!subgraphApiUrl) {
    console.error(`Subgraph URL for network ${network} is not defined.`);
    throw new Error(`Subgraph URL for network ${network} is not defined.`);
  }

  const liquidatedKeys = new Set<string>();

  // Apply the same base filters as fetchSubgraphMarkets
  // paginate until the API returns < pageSize items
  const pageSize = 1000;
  let skip = 0;
  while (true) {
    const variables = {
      first: pageSize,
      skip,
      where: { inputToken_not_in: blacklistTokens },
    };
    const page = await subgraphGraphqlFetcher<SubgraphMarketsLiquidationCheckResponse>(
      subgraphApiUrl,
      subgraphMarketsWithLiquidationCheckQuery,
      variables,
    );

    if (page.errors) {
      console.error('GraphQL errors:', page.errors);
      throw new Error(`GraphQL error fetching liquidated market keys for network ${network}`);
    }

    const markets = page.data?.markets;

    if (!markets) {
      console.warn(
        `No market data returned for liquidation check on network ${network} at skip ${skip}.`,
      );
      break; // Exit loop if no markets are returned
    }

    markets.forEach((market) => {
      // If the liquidates array has items, this market has had liquidations
      if (market.liquidates && market.liquidates.length > 0) {
        liquidatedKeys.add(market.id);
      }
    });

    if (markets.length < pageSize) {
      break; // Exit loop if the number of returned markets is less than the page size
    }
    skip += pageSize;
  }

  console.log(`Fetched ${liquidatedKeys.size} liquidated market keys via Subgraph for ${network}.`);
  return liquidatedKeys;
};
