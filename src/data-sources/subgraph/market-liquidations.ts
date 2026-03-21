import { marketLiquidationBadDebtQuery, marketLiquidationsPageQuery } from '@/graphql/morpho-subgraph-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketLiquidationTransaction, PaginatedMarketLiquidations } from '@/utils/types';
import { requireSubgraphUrl, subgraphGraphqlFetcher } from './fetchers';

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
  };
};

type SubgraphLiquidationBadDebtResponse = {
  data?: {
    badDebtRealizations?: SubgraphBadDebtItem[];
  };
};

/**
 * Fetches market liquidation activities from the Subgraph.
 * Fetches only the requested liquidation page and then resolves bad debt for those page rows.
 * @param marketId The ID of the market.
 * @param network The blockchain network.
 * @returns A promise resolving to paginated MarketLiquidationTransaction objects.
 */
export const fetchSubgraphMarketLiquidations = async (
  marketId: string,
  network: SupportedNetworks,
  first = 8,
  skip = 0,
): Promise<PaginatedMarketLiquidations> => {
  const subgraphUrl = requireSubgraphUrl(network);

  const variables = {
    marketId,
    first: first + 1,
    skip,
  };

  try {
    const result = await subgraphGraphqlFetcher<SubgraphLiquidationsResponse>(subgraphUrl, marketLiquidationsPageQuery, variables);
    if (!result.data) {
      throw Object.assign(new Error(`Subgraph returned no liquidation data for market ${marketId} on network ${network}`), {
        source: 'subgraph' as const,
        network,
      });
    }

    const liquidates = result.data?.liquidates ?? [];
    const hasNextPage = liquidates.length > first;
    const pageLiquidations = liquidates.slice(0, first);
    const liquidationIds = pageLiquidations.map((liquidation) => liquidation.id);
    const badDebtResult =
      liquidationIds.length === 0
        ? null
        : await subgraphGraphqlFetcher<SubgraphLiquidationBadDebtResponse>(subgraphUrl, marketLiquidationBadDebtQuery, {
            liquidationIds,
          });

    if (badDebtResult && !badDebtResult.data) {
      throw Object.assign(new Error(`Subgraph returned no bad debt data for market ${marketId} on network ${network}`), {
        source: 'subgraph' as const,
        network,
      });
    }

    const badDebtItems = badDebtResult?.data?.badDebtRealizations ?? [];

    // Create a map for quick lookup of bad debt by liquidation ID
    const badDebtMap = new Map<string, string>();
    for (const item of badDebtItems) {
      badDebtMap.set(item.liquidation.id, item.badDebt);
    }

    // Map liquidations, adding bad debt information
    const items: MarketLiquidationTransaction[] = pageLiquidations.map((liq) => ({
      type: 'MarketLiquidation',
      hash: liq.hash,
      timestamp: typeof liq.timestamp === 'string' ? Number.parseInt(liq.timestamp, 10) : liq.timestamp,
      liquidator: liq.liquidator.id,
      repaidAssets: liq.repaid,
      seizedAssets: liq.amount,
      badDebtAssets: badDebtMap.get(liq.id) ?? '0',
    }));

    return {
      items,
      totalCount: skip + items.length + Number(hasNextPage),
      hasNextPage,
    };
  } catch (error) {
    console.error(`Error fetching or processing Subgraph market liquidations for ${marketId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching subgraph market liquidations');
  }
};
