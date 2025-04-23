import { marketLiquidationsAndBadDebtQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { MarketLiquidationTransaction } from '@/utils/types'; // Import simplified type
import { subgraphGraphqlFetcher } from './fetchers';

// Types specific to the Subgraph response items
type SubgraphLiquidateItem = {
  id: string;
  hash: string;
  timestamp: number | string;
  repaid: string;
  amount: string;
  liquidator: {
    id: string;
  };
};

type SubgraphBadDebtItem = {
  badDebt: string;
  liquidation: {
    id: string;
  };
};

// Type for the overall Subgraph response
type SubgraphLiquidationsResponse = {
  data?: {
    liquidates?: SubgraphLiquidateItem[];
    badDebtRealizations?: SubgraphBadDebtItem[];
  };
};

/**
 * Fetches market liquidation activities from the Subgraph.
 * Combines liquidation events with associated bad debt realizations.
 * @param marketId The ID of the market.
 * @param network The blockchain network.
 * @returns A promise resolving to an array of simplified MarketLiquidationTransaction objects.
 */
export const fetchSubgraphMarketLiquidations = async (
  marketId: string,
  network: SupportedNetworks,
): Promise<MarketLiquidationTransaction[]> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.error(`No Subgraph URL configured for network: ${network}`);
    throw new Error(`Subgraph URL not available for network ${network}`);
  }

  const variables = { marketId };

  try {
    const result = await subgraphGraphqlFetcher<SubgraphLiquidationsResponse>(
      subgraphUrl,
      marketLiquidationsAndBadDebtQuery,
      variables,
    );

    const liquidates = result.data?.liquidates ?? [];
    const badDebtItems = result.data?.badDebtRealizations ?? [];

    // Create a map for quick lookup of bad debt by liquidation ID
    const badDebtMap = new Map<string, string>();
    badDebtItems.forEach((item) => {
      badDebtMap.set(item.liquidation.id, item.badDebt);
    });

    // Map liquidations, adding bad debt information
    return liquidates.map((liq) => ({
      type: 'MarketLiquidation',
      hash: liq.hash,
      timestamp: typeof liq.timestamp === 'string' ? parseInt(liq.timestamp, 10) : liq.timestamp,
      // Subgraph query doesn't provide liquidator, use empty string or default
      liquidator: liq.liquidator.id,
      repaidAssets: liq.repaid, // Loan asset repaid
      seizedAssets: liq.amount, // Collateral seized
      // Fetch bad debt from the map using the liquidate event ID
      badDebtAssets: badDebtMap.get(liq.id) ?? '0', // Default to '0' if no bad debt entry
    }));
  } catch (error) {
    console.error(
      `Error fetching or processing Subgraph market liquidations for ${marketId}:`,
      error,
    );
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market liquidations');
  }
};
