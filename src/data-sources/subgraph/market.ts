import { Address } from 'viem';
import {
  marketQuery as subgraphMarketQuery,
  marketsQuery as subgraphMarketsQuery,
} from '@/graphql/morpho-subgraph-queries'; // Assuming query is here
import { SupportedNetworks } from '@/utils/networks';
import {
  SubgraphMarket,
  SubgraphMarketQueryResponse,
  SubgraphMarketsQueryResponse,
  SubgraphToken,
} from '@/utils/subgraph-types';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { WarningWithDetail, MorphoChainlinkOracleData, Market } from '@/utils/types';
import { subgraphGraphqlFetcher } from './fetchers';

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
};

const transformSubgraphMarketToMarket = (
  subgraphMarket: Partial<SubgraphMarket>,
  network: SupportedNetworks,
): Market => {
  const marketId = subgraphMarket.id ?? '';
  const lltv = subgraphMarket.lltv ?? '0';
  const irmAddress = subgraphMarket.irm ?? '0x';
  const inputTokenPriceUSD = subgraphMarket.inputTokenPriceUSD ?? '0';
  const totalDepositBalanceUSD = subgraphMarket.totalDepositBalanceUSD ?? '0';
  const totalBorrowBalanceUSD = subgraphMarket.totalBorrowBalanceUSD ?? '0';
  const totalSupplyShares = subgraphMarket.totalSupplyShares ?? '0';
  const totalBorrowShares = subgraphMarket.totalBorrowShares ?? '0';
  const fee = subgraphMarket.fee ?? '0';

  const mapToken = (token: Partial<SubgraphToken> | undefined) => ({
    id: token?.id ?? '0x',
    address: token?.id ?? '0x',
    symbol: token?.symbol ?? 'Unknown',
    name: token?.name ?? 'Unknown Token',
    decimals: token?.decimals ?? 18,
  });

  const loanAsset = mapToken(subgraphMarket.borrowedToken);
  const collateralAsset = mapToken(subgraphMarket.inputToken);

  const defaultOracleData: MorphoChainlinkOracleData = {
    baseFeedOne: null,
    baseFeedTwo: null,
    quoteFeedOne: null,
    quoteFeedTwo: null,
  };

  const chainId = network;

  const borrowAssets = subgraphMarket.totalBorrow ?? '0';
  const supplyAssets = subgraphMarket.totalSupply ?? '0';
  const collateralAssets = subgraphMarket.inputTokenBalance ?? '0';
  const collateralAssetsUsd = safeParseFloat(subgraphMarket.totalValueLockedUSD);
  const timestamp = safeParseInt(subgraphMarket.lastUpdate);

  const totalSupplyNum = safeParseFloat(supplyAssets);
  const totalBorrowNum = safeParseFloat(borrowAssets);
  const utilization = totalSupplyNum > 0 ? (totalBorrowNum / totalSupplyNum) * 100 : 0;

  const supplyApy = Number(subgraphMarket.rates?.find((r) => r.side === 'LENDER')?.rate ?? 0);
  const borrowApy = Number(subgraphMarket.rates?.find((r) => r.side === 'BORROWER')?.rate ?? 0);

  const liquidityAssets = (BigInt(supplyAssets) - BigInt(borrowAssets)).toString();
  const liquidityAssetsUsd =
    safeParseFloat(totalDepositBalanceUSD) - safeParseFloat(totalBorrowBalanceUSD);

  const warningsWithDetail: WarningWithDetail[] = []; // Subgraph doesn't provide warnings directly

  const marketDetail: Market = {
    id: marketId,
    uniqueKey: marketId,
    lltv: lltv,
    irmAddress: irmAddress as Address,
    collateralPrice: inputTokenPriceUSD,
    loanAsset: loanAsset,
    collateralAsset: collateralAsset,
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
      fee: safeParseFloat(fee) / 10000, // Subgraph fee is likely basis points (needs verification)
      timestamp: timestamp,
      rateAtUTarget: 0, // Not available from subgraph
    },
    oracleAddress: subgraphMarket.oracle?.oracleAddress ?? '0x',
    morphoBlue: {
      id: subgraphMarket.protocol?.id ?? '0x',
      address: subgraphMarket.protocol?.id ?? '0x',
      chain: {
        id: chainId,
      },
    },
    warnings: [], // Subgraph doesn't provide warnings
    warningsWithDetail: warningsWithDetail,
    oracle: {
      data: defaultOracleData, // Placeholder oracle data
    },
    isProtectedByLiquidationBots: false, // Not available from subgraph
    badDebt: undefined, // Not available from subgraph
    realizedBadDebt: undefined, // Not available from subgraph
  };

  return marketDetail;
};

// Fetcher for market details from Subgraph
export const fetchSubgraphMarket = async (
  uniqueKey: string,
  network: SupportedNetworks,
): Promise<Market | null> => {
  const subgraphApiUrl = getSubgraphUrl(network);

  if (!subgraphApiUrl) {
    console.error(`Subgraph URL for network ${network} is not defined.`);
    throw new Error(`Subgraph URL for network ${network} is not defined.`);
  }

  const response = await subgraphGraphqlFetcher<SubgraphMarketQueryResponse>(
    subgraphApiUrl,
    subgraphMarketQuery,
    {
      id: uniqueKey.toLowerCase(), // Ensure ID is lowercase for subgraph
    },
  );

  const marketData = response.data.market;

  if (!marketData) {
    console.warn(`Market with key ${uniqueKey} not found in Subgraph response.`);
    return null; // Return null if not found, hook can handle this
  }

  return transformSubgraphMarketToMarket(marketData, network);
};

// Fetcher for multiple markets from Subgraph
export const fetchSubgraphMarkets = async (
  network: SupportedNetworks,
  // Optional filter, adjust based on actual subgraph schema capabilities
  // filter?: { [key: string]: any },
): Promise<Market[]> => {
  const subgraphApiUrl = getSubgraphUrl(network);

  if (!subgraphApiUrl) {
    console.error(`Subgraph URL for network ${network} is not defined.`);
    throw new Error(`Subgraph URL for network ${network} is not defined.`);
  }

  // Construct variables for the query
  const variables: { first: number; where?: Record<string, any>; network?: string } = {
    first: 1000, // Max limit
    // If filtering is needed and supported by the schema, add it here
    // where: filter,
    // Pass network if the query uses it for filtering
    // network: network === SupportedNetworks.Base ? 'BASE' : 'MAINNET', // Example mapping
  };

  // Use the new marketsQuery
  const response = await subgraphGraphqlFetcher<SubgraphMarketsQueryResponse>( // Use the new response type
    subgraphApiUrl,
    subgraphMarketsQuery, // Use the new query
    variables,
  );

  // Assuming the response structure matches the single market query for the list
  const marketsData = response.data.markets; // Adjust based on actual response structure

  if (!marketsData || !Array.isArray(marketsData)) {
    console.warn(`No markets found or invalid format in Subgraph response for network ${network}.`);
    return []; // Return empty array if no markets or error
  }

  // Transform each market
  return marketsData.map((market) => transformSubgraphMarketToMarket(market, network));
};
