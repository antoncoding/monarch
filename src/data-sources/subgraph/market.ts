import { Address } from 'viem';
import {
  marketQuery as subgraphMarketQuery,
  marketsQuery as subgraphMarketsQuery,
} from '@/graphql/morpho-subgraph-queries'; // Assuming query is here
import { formatBalance } from '@/utils/balance';
import { SupportedNetworks } from '@/utils/networks';
import {
  SubgraphMarket,
  SubgraphMarketQueryResponse,
  SubgraphMarketsQueryResponse,
  SubgraphToken,
} from '@/utils/subgraph-types';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import {
  blacklistTokens,
  ERC20Token,
  findToken,
  UnknownERC20Token,
  TokenPeg,
} from '@/utils/tokens';
import { WarningWithDetail, MorphoChainlinkOracleData, Market } from '@/utils/types';
import { subgraphGraphqlFetcher } from './fetchers';

// Define the structure for the fetched prices locally
type LocalMajorPrices = {
  [TokenPeg.BTC]?: number;
  [TokenPeg.ETH]?: number;
};

// Define expected type for CoinGecko API response
type CoinGeckoPriceResponse = {
  bitcoin?: { usd?: number };
  ethereum?: { usd?: number };
};

// CoinGecko API endpoint
const COINGECKO_API_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd';

// Fetcher for major prices needed for estimation
const fetchLocalMajorPrices = async (): Promise<LocalMajorPrices> => {
  try {
    const response = await fetch(COINGECKO_API_URL);
    if (!response.ok) {
      throw new Error(`Internal CoinGecko API request failed with status ${response.status}`);
    }
    // Type the JSON response
    const data = (await response.json()) as CoinGeckoPriceResponse;
    const prices: LocalMajorPrices = {
      [TokenPeg.BTC]: data.bitcoin?.usd,
      [TokenPeg.ETH]: data.ethereum?.usd,
    };
    // Filter out undefined prices
    return Object.entries(prices).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof LocalMajorPrices] = value;
      }
      return acc;
    }, {} as LocalMajorPrices);
  } catch (err) {
    console.error('Failed to fetch internal major token prices for subgraph estimation:', err);
    return {}; // Return empty object on error
  }
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
};

const transformSubgraphMarketToMarket = (
  subgraphMarket: Partial<SubgraphMarket>,
  network: SupportedNetworks,
  majorPrices: LocalMajorPrices,
): Market => {
  const marketId = subgraphMarket.id ?? '';
  const lltv = subgraphMarket.lltv ?? '0';
  const irmAddress = subgraphMarket.irm ?? '0x';
  const inputTokenPriceUSD = subgraphMarket.inputTokenPriceUSD ?? '0';

  const totalBorrowBalanceUSD = subgraphMarket.totalBorrowBalanceUSD ?? '0';
  const totalSupplyShares = subgraphMarket.totalSupplyShares ?? '0';
  const totalBorrowShares = subgraphMarket.totalBorrowShares ?? '0';
  const fee = subgraphMarket.fee ?? '0';

  // Define the estimation helper *inside* the transform function
  // so it has access to majorPrices
  const getEstimateValue = (token: ERC20Token | UnknownERC20Token): number | undefined => {
    if (!('peg' in token) || token.peg === undefined) {
      return undefined;
    }
    const peg = token.peg as TokenPeg;
    if (peg === TokenPeg.USD) {
      return 1;
    }
    // Access majorPrices from the outer function's scope
    return majorPrices[peg];
  };

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

  // @todo: might update due to input token being used here
  const supplyAssets = subgraphMarket.totalSupply ?? subgraphMarket.inputTokenBalance ?? '0';
  const borrowAssets =
    subgraphMarket.totalBorrow ?? subgraphMarket.variableBorrowedTokenBalance ?? '0';
  const collateralAssets = subgraphMarket.totalCollateral ?? '0';

  const timestamp = safeParseInt(subgraphMarket.lastUpdate);

  const totalSupplyNum = safeParseFloat(supplyAssets);
  const totalBorrowNum = safeParseFloat(borrowAssets);
  const utilization = totalSupplyNum > 0 ? (totalBorrowNum / totalSupplyNum) * 100 : 0;

  const supplyApy = Number(subgraphMarket.rates?.find((r) => r.side === 'LENDER')?.rate ?? 0);
  const borrowApy = Number(subgraphMarket.rates?.find((r) => r.side === 'BORROWER')?.rate ?? 0);

  // only borrowBalanceUSD is available in subgraph, we need to calculate supplyAssetsUsd, liquidityAssetsUsd, collateralAssetsUsd
  const borrowAssetsUsd = safeParseFloat(totalBorrowBalanceUSD);

  // get the prices
  let loanAssetPrice = safeParseFloat(subgraphMarket.borrowedToken?.lastPriceUSD ?? '0');
  let collateralAssetPrice = safeParseFloat(subgraphMarket.inputToken?.lastPriceUSD ?? '0');

  // @todo: might update due to input token being used here
  const hasUSDPrice = loanAssetPrice > 0 && collateralAssetPrice > 0;
  if (!hasUSDPrice) {
    // no price available, try to estimate

    const knownLoadAsset = findToken(loanAsset.address, network);
    if (knownLoadAsset) {
      loanAssetPrice = getEstimateValue(knownLoadAsset) ?? 0;
    }
    const knownCollateralAsset = findToken(collateralAsset.address, network);
    if (knownCollateralAsset) {
      collateralAssetPrice = getEstimateValue(knownCollateralAsset) ?? 0;
    }
  }

  const supplyAssetsUsd = formatBalance(supplyAssets, loanAsset.decimals) * loanAssetPrice;

  const liquidityAssets = (BigInt(supplyAssets) - BigInt(borrowAssets)).toString();
  const liquidityAssetsUsd = formatBalance(liquidityAssets, loanAsset.decimals) * loanAssetPrice;

  const collateralAssetsUsd =
    formatBalance(collateralAssets, collateralAsset.decimals) * collateralAssetPrice;

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
      // assets
      borrowAssets: borrowAssets,
      supplyAssets: supplyAssets,
      liquidityAssets: liquidityAssets,
      collateralAssets: collateralAssets,
      // shares
      borrowShares: totalBorrowShares,
      supplyShares: totalSupplyShares,
      // usd
      borrowAssetsUsd: borrowAssetsUsd,
      supplyAssetsUsd: supplyAssetsUsd,
      liquidityAssetsUsd: liquidityAssetsUsd,
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
    hasUSDPrice: hasUSDPrice,
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

  // Fetch major prices needed for potential estimation
  const majorPrices = await fetchLocalMajorPrices();

  return transformSubgraphMarketToMarket(marketData, network, majorPrices);
};

// Define type for GraphQL variables
type SubgraphMarketsVariables = {
  first: number;
  where?: {
    inputToken_not_in?: string[];
    // Add other potential filter fields here if needed
  };
  network?: string; // Keep network optional if sometimes omitted
};

// Fetcher for multiple markets from Subgraph
export const fetchSubgraphMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  const subgraphApiUrl = getSubgraphUrl(network);

  if (!subgraphApiUrl) {
    console.error(`Subgraph URL for network ${network} is not defined.`);
    throw new Error(`Subgraph URL for network ${network} is not defined.`);
  }

  // Construct variables for the query, adding blacklistTokens
  const variables: SubgraphMarketsVariables = {
    first: 1000, // Max limit
    where: {
      inputToken_not_in: blacklistTokens,
    },
  };

  // Use the new marketsQuery
  const response = await subgraphGraphqlFetcher<SubgraphMarketsQueryResponse>( // Use the new response type
    subgraphApiUrl,
    subgraphMarketsQuery, // Use the new query
    variables as unknown as Record<string, unknown>, // Convert via unknown
  );

  // Assuming the response structure matches the single market query for the list
  const marketsData = response.data.markets; // Adjust based on actual response structure

  if (!marketsData || !Array.isArray(marketsData)) {
    console.warn(`No markets found or invalid format in Subgraph response for network ${network}.`);
    return []; // Return empty array if no markets or error
  }

  // Fetch major prices *once* before transforming all markets
  const majorPrices = await fetchLocalMajorPrices();

  // Transform each market using the fetched prices
  return marketsData.map((market) => transformSubgraphMarketToMarket(market, network, majorPrices));
};
