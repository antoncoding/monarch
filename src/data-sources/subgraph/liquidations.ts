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
  const variables = {
    first: 1000, // Fetch in batches if necessary, though unlikely needed just for IDs
    where: {
      inputToken_not_in: blacklistTokens,
    },
  };

  try {
    // Subgraph might paginate; handle if necessary, but 1000 limit is often sufficient for just IDs
    const response = await subgraphGraphqlFetcher<SubgraphMarketsLiquidationCheckResponse>(
      subgraphApiUrl,
      subgraphMarketsWithLiquidationCheckQuery,
      variables,
    );

    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      throw new Error(`GraphQL error fetching liquidated market keys for network ${network}`);
    }

    const markets = response.data?.markets;

    if (!markets) {
      console.warn(`No market data returned for liquidation check on network ${network}.`);
      return liquidatedKeys; // Return empty set
    }

    markets.forEach((market) => {
      // If the liquidates array has items, this market has had liquidations
      if (market.liquidates && market.liquidates.length > 0) {
        liquidatedKeys.add(market.id);
      }
    });
  } catch (error) {
    console.error(`Error fetching liquidated market keys via Subgraph for network ${network}:`, error);
    throw error; // Re-throw
  }

  console.log(`Fetched ${liquidatedKeys.size} liquidated market keys via Subgraph for ${network}.`);
  return liquidatedKeys;
}; 