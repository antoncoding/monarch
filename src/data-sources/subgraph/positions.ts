import { request } from 'graphql-request';
import { fetchSubgraphMarket } from '@/data-sources/subgraph/market'; // Need market data too
import { subgraphUserPositionMarketsQuery } from '@/graphql/morpho-subgraph-queries';
import { subgraphUserMarketPositionQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { MarketPosition } from '@/utils/types';

// The type expected by MarketPosition.state
type MarketPositionState = {
  supplyShares: string;
  supplyAssets: string;
  borrowShares: string;
  borrowAssets: string;
  collateral: string; // This is collateral assets
};

type SubgraphPositionMarketResponse = {
  data?: {
    account?: {
      positions?: {
        market: {
          id: string;
        };
      }[];
    };
  };
  errors?: { message: string }[];
};

type SubgraphPosition = {
  id: string;
  asset: {
    id: string; // Token address
  };
  isCollateral: boolean | null;
  balance: string; // BigInt string
  side: 'SUPPLIER' | 'COLLATERAL' | 'BORROWER';
};

type SubgraphPositionResponse = {
  positions?: SubgraphPosition[];
};

/**
 * Fetches the unique keys of markets where a user has a position from the Subgraph.
 */
export const fetchSubgraphUserPositionMarkets = async (
  userAddress: string,
  network: SupportedNetworks,
): Promise<{ marketUniqueKey: string; chainId: number }[]> => {
  const endpoint = getSubgraphUrl(network);
  if (!endpoint) {
    console.warn(`No subgraph endpoint found for network ${network}`);
    return [];
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: subgraphUserPositionMarketsQuery,
        variables: {
          userId: userAddress.toLowerCase(),
        },
      }),
    });

    const result = (await response.json()) as SubgraphPositionMarketResponse;

    if (result.errors) {
      console.error(
        `Subgraph error fetching position markets for ${userAddress} on ${network}:`,
        result.errors,
      );
      throw new Error(result.errors.map((e) => e.message).join('; '));
    }

    const positions = result.data?.account?.positions ?? [];

    return positions.map((pos) => ({
      marketUniqueKey: pos.market.id,
      chainId: network, // The network ID is passed in
    }));
  } catch (error) {
    console.error(
      `Failed to fetch position markets from subgraph for ${userAddress} on ${network}:`,
      error,
    );
    return []; // Return empty array on error
  }
};

/**
 * Fetches and reconstructs a user's position for a specific market from the Subgraph.
 * Combines position data with market data.
 */
export const fetchSubgraphUserPositionForMarket = async (
  marketUniqueKey: string,
  userAddress: string,
  network: SupportedNetworks,
): Promise<MarketPosition | null> => {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.error(`Subgraph URL not configured for network ${network}.`);
    return null;
  }

  try {
    // 1. Fetch the market details first (needed for context)
    const market = await fetchSubgraphMarket(marketUniqueKey, network);
    if (!market) {
      console.warn(
        `Market ${marketUniqueKey} not found via subgraph on ${network} while fetching user position.`,
      );
      return null; // Cannot proceed without market details
    }

    // 2. Fetch the user's positions within that market
    const response = await request<SubgraphPositionResponse>(
      subgraphUrl,
      subgraphUserMarketPositionQuery,
      {
        marketId: marketUniqueKey.toLowerCase(), // Ensure lowercase for subgraph ID matching
        userId: userAddress.toLowerCase(),
      },
    );

    const positions = response.positions ?? [];

    // 3. Reconstruct the MarketPosition.state object
    let supplyShares = '0';
    let supplyAssets = '0';
    let borrowShares = '0';
    let borrowAssets = '0';
    let collateralAssets = '0';

    positions.forEach((pos) => {
      const balanceStr = pos.balance;
      if (!balanceStr || balanceStr === '0') return; // Ignore zero/empty balances

      switch (pos.side) {
        case 'SUPPLIER':
          // Assuming the SUPPLIER asset is always the loan asset
          if (pos.asset.id.toLowerCase() === market.loanAsset.address.toLowerCase()) {
            // Subgraph returns shares for SUPPLIER side in `balance`
            supplyShares = balanceStr;
            // We also need supplyAssets. Subgraph might not directly provide this for the position.
            // We might need to calculate it using market.state conversion rates, or rely on fetchPositionSnapshot.
            // For now, let's assume fetchPositionSnapshot is the primary source for accurate assets.
            // If falling back here, we might lack the direct asset value from subgraph.
            // Let's set assets based on shares * rate, IF market state has the rates.
            // This requires market.state.supplyAssets and market.state.supplyShares
            const marketTotalSupplyAssets = BigInt(market.state.supplyAssets || '0');
            const marketTotalSupplyShares = BigInt(market.state.supplyShares || '1'); // Avoid div by zero
            supplyAssets =
              marketTotalSupplyShares > 0n
                ? (
                    (BigInt(supplyShares) * marketTotalSupplyAssets) /
                    marketTotalSupplyShares
                  ).toString()
                : '0';
          } else {
            console.warn(
              `Subgraph position side 'SUPPLIER' doesn't match loan asset for market ${marketUniqueKey}`,
            );
          }
          break;
        case 'COLLATERAL':
          // Assuming the COLLATERAL asset is always the collateral asset
          if (pos.asset.id.toLowerCase() === market.collateralAsset.address.toLowerCase()) {
            // Subgraph 'balance' for collateral IS THE ASSET AMOUNT
            collateralAssets = balanceStr;
          } else {
            console.warn(
              `Subgraph position side 'COLLATERAL' doesn't match collateral asset for market ${marketUniqueKey}`,
            );
          }
          break;
        case 'BORROWER':
          // Assuming the BORROWER asset is always the loan asset
          if (pos.asset.id.toLowerCase() === market.loanAsset.address.toLowerCase()) {
            // Subgraph returns shares for BORROWER side in `balance`
            borrowShares = balanceStr;
            // Calculate borrowAssets from shares
            const marketTotalBorrowAssets = BigInt(market.state.borrowAssets || '0');
            const marketTotalBorrowShares = BigInt(market.state.borrowShares || '1'); // Avoid div by zero
            borrowAssets =
              marketTotalBorrowShares > 0n
                ? (
                    (BigInt(borrowShares) * marketTotalBorrowAssets) /
                    marketTotalBorrowShares
                  ).toString()
                : '0';
          } else {
            console.warn(
              `Subgraph position side 'BORROWER' doesn't match loan asset for market ${marketUniqueKey}`,
            );
          }
          break;
      }
    });

    // Check if the user has any position (check assets)
    if (supplyAssets === '0' && collateralAssets === '0' && borrowAssets === '0') {
      // If all balances are zero, treat as no position found for this market
      return null; // Return null as per MarketPosition type possibility
    }

    const state: MarketPositionState = {
      supplyAssets: supplyAssets,
      supplyShares: supplyShares,
      collateral: collateralAssets, // Use the direct asset amount
      borrowAssets: borrowAssets,
      borrowShares: borrowShares,
    };

    return {
      market,
      state: state,
    };
  } catch (error) {
    console.error(
      `Failed to fetch user position for market ${marketUniqueKey} from Subgraph on ${network}:`,
      error,
    );
    return null; // Return null on error
  }
};
