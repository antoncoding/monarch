import type { Address } from 'viem';
import { marketQuery as subgraphMarketQuery, marketsQuery as subgraphMarketsQuery } from '@/graphql/morpho-subgraph-queries'; // Assuming query is here
import { formatBalance } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import type { SubgraphMarket, SubgraphMarketQueryResponse, SubgraphMarketsQueryResponse, SubgraphToken } from '@/utils/subgraph-types';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { blacklistTokens, type ERC20Token, findToken, type UnknownERC20Token, TokenPeg } from '@/utils/tokens';
import type { Market, MarketWarning } from '@/utils/types';
import { SUBGRAPH_NO_PRICE, UNRECOGNIZED_COLLATERAL, UNRECOGNIZED_LOAN } from '@/utils/warnings';
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
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd';

// Fetcher for major prices needed for estimation
const priceCache: { data?: LocalMajorPrices; ts?: number } = {};
const fetchLocalMajorPrices = async (): Promise<LocalMajorPrices> => {
  if (priceCache.data && Date.now() - (priceCache.ts ?? 0) < 60_000) {
    return priceCache.data;
  }
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
    const result = Object.entries(prices).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof LocalMajorPrices] = value;
      }
      return acc;
    }, {} as LocalMajorPrices);
    priceCache.data = result;
    priceCache.ts = Date.now();
    return result;
  } catch (err) {
    console.error('Failed to fetch internal major token prices for subgraph estimation:', err);
    return {}; // Return empty object on error
  }
};

// Helper to safely parse BigDecimal/BigInt strings
const safeParseFloat = (value: string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  try {
    return Number.parseFloat(value);
  } catch {
    return 0;
  }
};

const safeParseInt = (value: string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  try {
    return Number.parseInt(value, 10);
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
  const oracleAddress = (subgraphMarket.oracle?.oracleAddress ?? '0x') as Address;

  const totalSupplyShares = subgraphMarket.totalSupplyShares ?? '0';
  const totalBorrowShares = subgraphMarket.totalBorrowShares ?? '0';
  const fee = subgraphMarket.fee ?? '0';

  const getEstimateValue = (token: ERC20Token | UnknownERC20Token): number | undefined => {
    if (!('peg' in token) || token.peg === undefined) {
      return undefined;
    }
    const peg = token.peg as TokenPeg;
    if (peg === TokenPeg.USD) {
      return 1;
    }
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

  const chainId = network;

  const supplyAssets = subgraphMarket.totalSupply ?? subgraphMarket.inputTokenBalance ?? '0';
  const borrowAssets = subgraphMarket.totalBorrow ?? subgraphMarket.variableBorrowedTokenBalance ?? '0';
  const collateralAssets = subgraphMarket.totalCollateral ?? '0';

  const timestamp = safeParseInt(subgraphMarket.lastUpdate);

  const totalSupplyNum = safeParseFloat(supplyAssets);
  const totalBorrowNum = safeParseFloat(borrowAssets);
  const utilization = totalSupplyNum > 0 ? totalBorrowNum / totalSupplyNum : 0;

  const supplyApy = Number(subgraphMarket.rates?.find((r) => r.side === 'LENDER')?.rate ?? 0);
  const borrowApy = Number(subgraphMarket.rates?.find((r) => r.side === 'BORROWER')?.rate ?? 0);

  const warnings: MarketWarning[] = [];

  let loanAssetPrice = safeParseFloat(subgraphMarket.borrowedToken?.lastPriceUSD ?? '0');
  let collateralAssetPrice = safeParseFloat(subgraphMarket.inputToken?.lastPriceUSD ?? '0');
  const hasUSDPrice = loanAssetPrice > 0 && collateralAssetPrice > 0;

  const knownLoadAsset = findToken(loanAsset.address, network);
  const knownCollateralAsset = findToken(collateralAsset.address, network);

  if (!knownLoadAsset) {
    warnings.push(UNRECOGNIZED_LOAN);
  }
  if (!knownCollateralAsset) {
    warnings.push(UNRECOGNIZED_COLLATERAL);
  }

  if (!hasUSDPrice) {
    // no price available, try to estimate
    if (knownLoadAsset) {
      loanAssetPrice = getEstimateValue(knownLoadAsset) ?? 0;
    }
    if (knownCollateralAsset) {
      collateralAssetPrice = getEstimateValue(knownCollateralAsset) ?? 0;
    }
    warnings.push(SUBGRAPH_NO_PRICE);
  }

  const supplyAssetsUsd = formatBalance(supplyAssets, loanAsset.decimals) * loanAssetPrice;
  const borrowAssetsUsd = formatBalance(borrowAssets, loanAsset.decimals) * loanAssetPrice;

  const liquidityAssets = (BigInt(supplyAssets) - BigInt(borrowAssets)).toString();
  const liquidityAssetsUsd = formatBalance(liquidityAssets, loanAsset.decimals) * loanAssetPrice;

  const collateralAssetsUsd = formatBalance(collateralAssets, collateralAsset.decimals) * collateralAssetPrice;

  const marketDetail = {
    id: marketId,
    uniqueKey: marketId,
    lltv,
    irmAddress: irmAddress as Address,
    whitelisted: true,
    loanAsset,
    collateralAsset,
    state: {
      borrowAssets,
      supplyAssets,
      liquidityAssets,
      collateralAssets,
      borrowShares: totalBorrowShares,
      supplyShares: totalSupplyShares,
      borrowAssetsUsd,
      supplyAssetsUsd,
      liquidityAssetsUsd,
      collateralAssetsUsd,
      utilization,
      supplyApy,
      borrowApy,
      fee: safeParseFloat(fee) / 10_000,
      timestamp,
      apyAtTarget: 0,
      rateAtTarget: '0',
      // Subgraph doesn't support daily/weekly/monthly APY - return null
      dailySupplyApy: null,
      dailyBorrowApy: null,
      weeklySupplyApy: null,
      weeklyBorrowApy: null,
      monthlySupplyApy: null,
      monthlyBorrowApy: null,
    },
    oracleAddress,
    morphoBlue: {
      id: subgraphMarket.protocol?.id ?? '0x',
      address: subgraphMarket.protocol?.id ?? '0x',
      chain: { id: chainId },
    },
    warnings,
    hasUSDPrice,
    realizedBadDebt: { underlying: '0' },
    supplyingVaults: [],
  };

  return marketDetail;
};

// Fetcher for market details from Subgraph
export const fetchSubgraphMarket = async (uniqueKey: string, network: SupportedNetworks): Promise<Market | null> => {
  const subgraphApiUrl = getSubgraphUrl(network);

  if (!subgraphApiUrl) {
    console.warn(`Subgraph URL for network ${network} is not defined. Cannot fetch market.`);
    return null;
  }

  try {
    const response = await subgraphGraphqlFetcher<SubgraphMarketQueryResponse>(subgraphApiUrl, subgraphMarketQuery, {
      id: uniqueKey.toLowerCase(),
    });

    // Handle cases where GraphQL errors resulted in missing data
    const marketData = response?.data?.market;

    if (!marketData) {
      console.warn(`Market with key ${uniqueKey} not found in Subgraph response.`);
      return null;
    }

    const majorPrices = await fetchLocalMajorPrices();

    return transformSubgraphMarketToMarket(marketData, network, majorPrices);
  } catch (error) {
    console.error(`Error fetching subgraph market ${uniqueKey} on ${network}:`, error);
    return null;
  }
};

type SubgraphMarketsVariables = {
  first: number;
  where?: {
    inputToken_not_in?: string[];
  };
  network?: string;
};

export const fetchSubgraphMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  const subgraphApiUrl = getSubgraphUrl(network);

  if (!subgraphApiUrl) {
    console.warn(`Subgraph URL for network ${network} is not defined. Skipping subgraph fetch.`);
    return [];
  }

  const variables: SubgraphMarketsVariables = {
    first: 1000, // Max limit
    where: {
      inputToken_not_in: [...blacklistTokens, '0x0000000000000000000000000000000000000000'],
    },
  };

  try {
    const response = await subgraphGraphqlFetcher<SubgraphMarketsQueryResponse>(
      subgraphApiUrl,
      subgraphMarketsQuery,
      variables as unknown as Record<string, unknown>,
    );

    // Handle cases where GraphQL errors resulted in missing data
    const marketsData = response?.data?.markets;

    if (!marketsData || !Array.isArray(marketsData)) {
      console.warn(`No markets found or invalid format in Subgraph response for network ${network}.`);
      return [];
    }

    const majorPrices = await fetchLocalMajorPrices();
    return marketsData.map((market) => transformSubgraphMarketToMarket(market, network, majorPrices));
  } catch (error) {
    console.error(`Error fetching subgraph markets on ${network}:`, error);
    return [];
  }
};
