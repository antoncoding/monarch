import { Market as BlueMarket, MarketParams as BlueMarketParams } from '@morpho-org/blue-sdk';
import { marketDetailQuery, marketsQuery } from '@/graphql/morpho-api-queries';
import { isMarketRegistryEntryAllowed } from '@/utils/markets';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';
import { type Address, zeroAddress } from 'viem';

// API response type - matches the new Morpho API shape where oracleAddress is nested
type MorphoApiMarketState = Omit<
  Market['state'],
  'dailySupplyApy' | 'dailyBorrowApy' | 'weeklySupplyApy' | 'weeklyBorrowApy' | 'monthlySupplyApy' | 'monthlyBorrowApy'
> &
  Partial<
    Pick<
      Market['state'],
      'dailySupplyApy' | 'dailyBorrowApy' | 'weeklySupplyApy' | 'weeklyBorrowApy' | 'monthlySupplyApy' | 'monthlyBorrowApy'
    >
  >;

type MorphoApiMarket = Omit<Market, 'oracleAddress' | 'whitelisted' | 'state' | 'supplyingVaults'> & {
  oracle: { address: string } | null;
  state: MorphoApiMarketState;
  supplyingVaults?: { address: string }[];
};

type MarketGraphQLResponse = {
  data?: {
    marketByUniqueKey?: MorphoApiMarket;
  };
  errors?: { message: string }[];
};

// Define response type for multiple markets with pageInfo
type MarketsGraphQLResponse = {
  data?: {
    markets?: {
      items?: MorphoApiMarket[];
      pageInfo?: {
        countTotal: number;
      };
    };
  };
  errors?: { message: string }[];
};

type MarketKeysGraphQLResponse = {
  data?: {
    markets?: {
      items?: { uniqueKey?: string }[];
      pageInfo?: {
        countTotal: number;
      };
    };
  };
  errors?: { message: string }[];
};

type MorphoMarketsPage = {
  items: Market[];
  totalCount: number;
};

const MORPHO_MARKETS_PAGE_SIZE = 500;
const MORPHO_MARKETS_TIMEOUT_MS = 20_000;
const MORPHO_MARKETS_PAGE_BATCH_SIZE = 4;
const MORPHO_MARKET_DETAIL_BATCH_SIZE = 10;

const morphoMarketKeysQuery = `
  query getMarketKeys($first: Int, $skip: Int, $where: MarketFilters) {
    markets(first: $first, skip: $skip, where: $where) {
      items {
        uniqueKey
      }
      pageInfo {
        countTotal
      }
    }
  }
`;

const computeApyAtTarget = (market: MorphoApiMarket, state: MorphoApiMarketState): number => {
  if (state.apyAtTarget != null) {
    return state.apyAtTarget;
  }

  if (state.rateAtTarget == null) {
    return 0;
  }

  try {
    const params = new BlueMarketParams({
      loanToken: market.loanAsset.address as Address,
      collateralToken: market.collateralAsset.address as Address,
      oracle: (market.oracle?.address ?? zeroAddress) as Address,
      irm: market.irmAddress as Address,
      lltv: BigInt(market.lltv),
    });
    const blueMarket = new BlueMarket({
      params,
      totalSupplyAssets: BigInt(state.supplyAssets),
      totalBorrowAssets: BigInt(state.borrowAssets),
      totalSupplyShares: BigInt(state.supplyShares),
      totalBorrowShares: BigInt(state.borrowShares),
      lastUpdate: BigInt(state.timestamp),
      fee: BigInt(Math.floor(state.fee * 1e18)),
      rateAtTarget: BigInt(state.rateAtTarget),
    });

    return blueMarket.apyAtTarget ?? 0;
  } catch (error) {
    console.warn(`Failed to derive target APY for Morpho market ${market.uniqueKey}.`, error);
    return 0;
  }
};

// Transform API response to internal Market type
const processMarketData = (market: MorphoApiMarket): Market => {
  const { oracle, state, supplyingVaults, ...rest } = market;
  return {
    ...rest,
    oracleAddress: (oracle?.address ?? zeroAddress) as Address,
    // Whitelist status is now overlaid by the dedicated whitelist-status hook.
    whitelisted: false,
    hasUSDPrice: true,
    supplyingVaults: supplyingVaults ?? [],
    state: {
      ...state,
      dailySupplyApy: state.dailySupplyApy ?? null,
      dailyBorrowApy: state.dailyBorrowApy ?? null,
      weeklySupplyApy: state.weeklySupplyApy ?? null,
      weeklyBorrowApy: state.weeklyBorrowApy ?? null,
      monthlySupplyApy: state.monthlySupplyApy ?? null,
      monthlyBorrowApy: state.monthlyBorrowApy ?? null,
      apyAtTarget: computeApyAtTarget(market, state),
    },
  };
};

const filterRegistryMarkets = (markets: Market[]): Market[] =>
  markets.filter((market) =>
    isMarketRegistryEntryAllowed({
      loanAssetAddress: market.loanAsset?.address,
      collateralAssetAddress: market.collateralAsset?.address,
      irmAddress: market.irmAddress,
    }),
  );

// Fetcher for market details from Morpho API
export const fetchMorphoMarket = async (uniqueKey: string, network: SupportedNetworks): Promise<Market | null> => {
  const response = await morphoGraphqlFetcher<MarketGraphQLResponse>(marketDetailQuery, {
    uniqueKey,
    chainId: network,
  });
  if (!response || !response.data || !response.data.marketByUniqueKey) {
    throw new Error('Market data not found in Morpho API response');
  }

  const market = processMarketData(response.data.marketByUniqueKey);

  return filterRegistryMarkets([market])[0] ?? null;
};

const getMorphoMarketPageVariables = (network: SupportedNetworks, skip: number, pageSize: number) => ({
  first: pageSize,
  skip,
  where: {
    chainId_in: [network],
  },
});

const fetchMorphoMarketKeysPage = async (network: SupportedNetworks, skip: number, pageSize: number) => {
  const response = await morphoGraphqlFetcher<MarketKeysGraphQLResponse>(
    morphoMarketKeysQuery,
    getMorphoMarketPageVariables(network, skip, pageSize),
    {
      timeoutMs: MORPHO_MARKETS_TIMEOUT_MS,
    },
  );

  if (!response?.data?.markets?.pageInfo) {
    throw new Error(`Morpho market-keys response missing pageInfo for network ${network} at skip ${skip}.`);
  }

  if (!Array.isArray(response.data.markets.items)) {
    throw new Error(`Morpho market-keys response missing items for network ${network} at skip ${skip}.`);
  }

  return {
    keys: response.data.markets.items.map((item) => item.uniqueKey).filter((key): key is string => Boolean(key)),
    totalCount: response.data.markets.pageInfo.countTotal,
  };
};

const hydrateMorphoMarkets = async (uniqueKeys: string[], network: SupportedNetworks): Promise<Market[]> => {
  const markets: Market[] = [];

  for (let index = 0; index < uniqueKeys.length; index += MORPHO_MARKET_DETAIL_BATCH_SIZE) {
    const keyBatch = uniqueKeys.slice(index, index + MORPHO_MARKET_DETAIL_BATCH_SIZE);
    const settledMarkets = await Promise.allSettled(keyBatch.map((uniqueKey) => fetchMorphoMarket(uniqueKey, network)));

    settledMarkets.forEach((settledMarket, batchIndex) => {
      const uniqueKey = keyBatch[batchIndex];

      if (settledMarket.status === 'rejected') {
        console.warn(`Skipping malformed Morpho market ${uniqueKey} on network ${network}.`, settledMarket.reason);
        return;
      }

      if (settledMarket.value) {
        markets.push(settledMarket.value);
      }
    });
  }

  return markets;
};

const fetchMorphoMarketsPage = async (network: SupportedNetworks, skip: number, pageSize: number): Promise<MorphoMarketsPage> => {
  const variables = {
    ...getMorphoMarketPageVariables(network, skip, pageSize),
  };

  try {
    const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(marketsQuery, variables, {
      timeoutMs: MORPHO_MARKETS_TIMEOUT_MS,
    });

    if (!response?.data?.markets?.pageInfo) {
      throw new Error(`Morpho markets response missing pageInfo for network ${network} at skip ${skip}.`);
    }

    if (!Array.isArray(response.data.markets.items)) {
      throw new Error(`Morpho markets response missing items for network ${network} at skip ${skip}.`);
    }

    const { items: pageItems, pageInfo } = response.data.markets;

    return {
      items: pageItems.map(processMarketData),
      totalCount: pageInfo.countTotal,
    };
  } catch (error) {
    console.warn(`Morpho markets page hydration failed for network ${network} at skip ${skip}, retrying per market.`, error);
  }

  const keyPage = await fetchMorphoMarketKeysPage(network, skip, pageSize);
  const items = await hydrateMorphoMarkets(keyPage.keys, network);

  return {
    items,
    totalCount: keyPage.totalCount,
  };
};

// Fetcher for multiple markets from Morpho API with pagination
export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  const allMarkets: Market[] = [];
  const pageSize = MORPHO_MARKETS_PAGE_SIZE;

  const firstPage = await fetchMorphoMarketsPage(network, 0, pageSize);
  allMarkets.push(...firstPage.items);

  const totalCount = firstPage.totalCount;
  const nextOffsetStart = Math.min(pageSize, totalCount);

  const remainingOffsets: number[] = [];
  for (let nextSkip = nextOffsetStart; nextSkip < totalCount; nextSkip += pageSize) {
    remainingOffsets.push(nextSkip);
  }

  for (let index = 0; index < remainingOffsets.length; index += MORPHO_MARKETS_PAGE_BATCH_SIZE) {
    const offsetBatch = remainingOffsets.slice(index, index + MORPHO_MARKETS_PAGE_BATCH_SIZE);
    const settledPages = await Promise.allSettled(offsetBatch.map((skip) => fetchMorphoMarketsPage(network, skip, pageSize)));

    const successfulPages: MorphoMarketsPage[] = [];

    for (const settledPage of settledPages) {
      if (settledPage.status === 'rejected') {
        throw settledPage.reason;
      }
      successfulPages.push(settledPage.value);
    }

    successfulPages.forEach((page) => {
      allMarkets.push(...page.items);
    });
  }

  return filterRegistryMarkets(allMarkets);
};
