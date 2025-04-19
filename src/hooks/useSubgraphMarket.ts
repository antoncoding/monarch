import { useQuery } from '@tanstack/react-query';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls'; // Import the new URL getter
import { MarketDetail, TimeseriesOptions, WarningWithDetail, WarningCategory, MorphoChainlinkOracleData } from '../utils/types';
import {
  marketsQuery as subgraphMarketsQuery, // Keep old name for reference if needed
  marketQuery as subgraphMarketQuery // Import the new single market query
} from '../graphql/morpho-subgraph-queries';
import {
  SubgraphMarket,
  SubgraphMarketsQueryResponse, // Keep for reference if needed
  SubgraphMarketQueryResponse, // Use the single market response type
  SubgraphToken,
  SubgraphInterestRate,
  SubgraphOracle
} from '../utils/subgraph-types';
import { Address, formatUnits } from 'viem';

const subgraphGraphqlFetcher = async <T extends object>(
  apiUrl: string, // Accept URL as a parameter
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(apiUrl, { // Use the passed URL
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const result = (await response.json()) as T;

  // Basic error handling, specific to GraphQL structure
  if ('errors' in result && Array.isArray((result as any).errors) && (result as any).errors.length > 0) {
    throw new Error((result as any).errors[0].message);
  }

  return result;
};

// Helper to safely parse BigDecimal/BigInt strings
const safeParseFloat = (value: string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  try {
    return parseFloat(value);
  } catch {
    return 0;
  }
};

const safeParseInt = (value: string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    try {
        return parseInt(value, 10);
    } catch {
        return 0;
    }
}

// Transformation function
const transformSubgraphMarketToMarketDetail = (subgraphMarket: Partial<SubgraphMarket>, network: SupportedNetworks): MarketDetail => {
  // Use Partial<SubgraphMarket> as input type since not all fields are guaranteed

  // --- Handle fields from the simplified response --- 
  const marketId = subgraphMarket.id ?? ''; // This is the derived market ID/uniqueKey
  const lltv = subgraphMarket.lltv ?? '0';
  const irmAddress = subgraphMarket.irm ?? '0x';
  const inputTokenPriceUSD = subgraphMarket.inputTokenPriceUSD ?? '0';
  const totalDepositBalanceUSD = subgraphMarket.totalDepositBalanceUSD ?? '0';
  const totalBorrowBalanceUSD = subgraphMarket.totalBorrowBalanceUSD ?? '0';
  const totalSupplyShares = subgraphMarket.totalSupplyShares ?? '0';
  const totalBorrowShares = subgraphMarket.totalBorrowShares ?? '0';
  const fee = subgraphMarket.fee ?? '0';

  // Map token info - provide defaults if tokens are missing
  const mapToken = (token: Partial<SubgraphToken> | undefined) => ({
    id: token?.id ?? '0x', // Default to zero address
    address: token?.id ?? '0x', // Default to zero address
    symbol: token?.symbol ?? 'Unknown',
    name: token?.name ?? 'Unknown Token',
    decimals: token?.decimals ?? 18, // Default to 18 decimals
  });

  const loanAsset = mapToken(subgraphMarket.borrowedToken);
  const collateralAsset = mapToken(subgraphMarket.inputToken);

  // --- Provide defaults for missing fields --- 
  const defaultOracleData: MorphoChainlinkOracleData = {
    baseFeedOne: null,
    baseFeedTwo: null,
    quoteFeedOne: null,
    quoteFeedTwo: null,
  };

  // Placeholder for chain ID mapping
  // TODO: Implement mapping from subgraphMarket.protocol?.network string to chain ID number
  const chainId = network;

  // Default state values for fields not present in the simplified query
  const borrowAssets = subgraphMarket.totalBorrow ?? '0';
  const supplyAssets = subgraphMarket.totalSupply ?? '0';
  const collateralAssets = subgraphMarket.inputTokenBalance ?? '0';
  const collateralAssetsUsd = safeParseFloat(subgraphMarket.totalValueLockedUSD); // Use totalValueLockedUSD if available, else 0
  const timestamp = safeParseInt(subgraphMarket.lastUpdate); // Use lastUpdate if available, else 0

  // Calculate utilization safely with defaults
  const totalSupplyNum = safeParseFloat(supplyAssets);
  const totalBorrowNum = safeParseFloat(borrowAssets);
  const utilization = totalSupplyNum > 0 ? (totalBorrowNum / totalSupplyNum) * 100 : 0;

  // Default APYs (since rates are not fetched)
  const supplyApy = 0;
  const borrowApy = 0;

  // Liquidity calculation with defaults
  const liquidityAssets = (BigInt(supplyAssets) - BigInt(borrowAssets)).toString();
  const liquidityAssetsUsd = safeParseFloat(totalDepositBalanceUSD) - safeParseFloat(totalBorrowBalanceUSD);

  // Default warnings (isActive is not fetched in simplified query)
  const warningsWithDetail: WarningWithDetail[] = [];

  const marketDetail: MarketDetail = {
    // Mapped from simplified response
    id: marketId,
    uniqueKey: marketId,
    lltv: lltv,
    irmAddress: irmAddress as Address, // Cast to Address
    collateralPrice: inputTokenPriceUSD,
    loanAsset: loanAsset,
    collateralAsset: collateralAsset,
    
    // State mapped from simplified response + defaults
    state: {
      borrowAssets: borrowAssets, 
      supplyAssets: supplyAssets, 
      borrowAssetsUsd: totalBorrowBalanceUSD, 
      supplyAssetsUsd: totalDepositBalanceUSD, 
      borrowShares: totalBorrowShares, 
      supplyShares: totalSupplyShares, 
      liquidityAssets: liquidityAssets, 
      liquidityAssetsUsd: liquidityAssetsUsd,
      collateralAssets: collateralAssets, 
      collateralAssetsUsd: collateralAssetsUsd, 
      utilization: utilization,
      supplyApy: supplyApy,
      borrowApy: borrowApy,
      // Fee: Assuming conversion from basis points (10000 = 100%)
      fee: safeParseFloat(fee) / 100, // Divide by 100 if fee is basis points * 100
      timestamp: timestamp,
      rateAtUTarget: 0, // Default
    },

    // Defaulted fields
    oracleAddress: subgraphMarket.oracle?.oracleAddress ?? '0x', // Default to zero address
    morphoBlue: {
      id: subgraphMarket.protocol?.id ?? '0x', // Default
      address: subgraphMarket.protocol?.id ?? '0x', // Default
      chain: {
        id: chainId,
      },
    },
    warnings: [], // Default
    warningsWithDetail: warningsWithDetail, // Default
    oracle: {
        data: defaultOracleData, // Default
    },
    isProtectedByLiquidationBots: false, // Default
    badDebt: undefined, // Default
    realizedBadDebt: undefined, // Default
    historicalState: { // Default empty historical
      supplyApy: [],
      borrowApy: [],
      supplyAssetsUsd: [],
      borrowAssetsUsd: [],
      rateAtUTarget: [],
      utilization: [],
      supplyAssets: [],
      borrowAssets: [],
      liquidityAssetsUsd: [],
      liquidityAssets: [],
    },
  };

  return marketDetail;
};

// Hook to fetch a specific market using its ID (uniqueKey)
export const useSubgraphMarket = (uniqueKey: string | undefined, network: SupportedNetworks) => {
  return useQuery<MarketDetail | null>({ // Allow null if market not found
    queryKey: ['subgraphMarket', uniqueKey, network],
    queryFn: async () => {
      if (!uniqueKey || !network) return null; // Also check if network is provided

      const subgraphApiUrl = getSubgraphUrl(network);

      if (!subgraphApiUrl) {
        console.error(`Subgraph URL for network ${network} is not defined.`);
        throw new Error(`Subgraph URL for network ${network} is not defined.`); // Or return null
      }

      // Use the new query for a single market
      const response = await subgraphGraphqlFetcher<SubgraphMarketQueryResponse>(
          subgraphApiUrl, // Pass the dynamically selected URL
          subgraphMarketQuery,
          {
            id: uniqueKey.toLowerCase() // Pass the uniqueKey as the id variable
          }
      );

      // Get the market data directly from the response
      const marketData = response.data.market;

      if (!marketData) {
        console.warn(`Market with key ${uniqueKey} not found in Subgraph response.`);
        return null; // Market not found or query returned null
      }

      return transformSubgraphMarketToMarketDetail(marketData, network);
    },
    enabled: !!uniqueKey && !!network, // Only run query if uniqueKey and network are available
    staleTime: 1000 * 60 * 5, // Cache data for 5 minutes
  });
};

// TODO: Add useSubgraphMarketHistoricalData if needed, requires adding historical queries to the subgraph file. 