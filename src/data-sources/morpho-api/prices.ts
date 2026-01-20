import { assetPricesQuery } from '@/graphql/morpho-api-queries';
import { morphoGraphqlFetcher } from './fetchers';

// Type for token price input
export type TokenPriceInput = {
  address: string;
  chainId: number;
};

// Type for asset price response from Morpho API
type AssetPriceItem = {
  address: string;
  symbol: string;
  decimals: number;
  chain: {
    id: number;
  };
  priceUsd: number | null;
};

type AssetPricesResponse = {
  data?: {
    assets?: {
      items?: AssetPriceItem[];
    };
  };
};

// Create a unique key for token prices
export const getTokenPriceKey = (address: string, chainId: number): string => {
  return `${address.toLowerCase()}-${chainId}`;
};

/**
 * Fetches token prices from Morpho API for a list of tokens
 * @param tokens - Array of token addresses and chain IDs
 * @returns Map of token prices keyed by address-chainId
 */
export const fetchTokenPrices = async (tokens: TokenPriceInput[]): Promise<Map<string, number>> => {
  if (tokens.length === 0) {
    return new Map();
  }

  // Group tokens by chain for efficient querying
  const tokensByChain = new Map<number, string[]>();
  tokens.forEach((token) => {
    const existing = tokensByChain.get(token.chainId) ?? [];
    // Deduplicate and lowercase addresses
    const normalizedAddress = token.address.toLowerCase();
    if (!existing.includes(normalizedAddress)) {
      existing.push(normalizedAddress);
    }
    tokensByChain.set(token.chainId, existing);
  });

  // Fetch prices for all chains in parallel
  const priceMap = new Map<string, number>();

  await Promise.all(
    Array.from(tokensByChain.entries()).map(async ([chainId, addresses]) => {
      try {
        const response = await morphoGraphqlFetcher<AssetPricesResponse>(assetPricesQuery, {
          where: {
            address_in: addresses,
            chainId_in: [chainId],
          },
        });

        // Handle NOT_FOUND - skip this chain
        if (!response) {
          return;
        }

        if (!response.data?.assets?.items) {
          console.warn(`No price data returned for chain ${chainId}`);
          return;
        }

        // Process each asset and add to price map
        response.data.assets.items.forEach((asset) => {
          if (asset.priceUsd !== null) {
            const key = getTokenPriceKey(asset.address, asset.chain.id);
            priceMap.set(key, asset.priceUsd);
          }
        });
      } catch (error) {
        console.error(`Failed to fetch prices for chain ${chainId}:`, error);
      }
    }),
  );

  return priceMap;
};
