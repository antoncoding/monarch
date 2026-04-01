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

type MorphoMarketsPage = {
  items: Market[];
  totalCount: number;
};

const MORPHO_MARKETS_PAGE_SIZE = 500;
const MORPHO_MARKETS_TIMEOUT_MS = 20_000;
const MORPHO_MARKETS_PAGE_BATCH_SIZE = 4;

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

const fetchMorphoMarketsPage = async (network: SupportedNetworks, skip: number, pageSize: number): Promise<MorphoMarketsPage | null> => {
  const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(
    marketsQuery,
    {
      first: pageSize,
      skip,
      where: {
        chainId_in: [network],
      },
    },
    {
      timeoutMs: MORPHO_MARKETS_TIMEOUT_MS,
    },
  );

  if (!response?.data?.markets?.pageInfo) {
    throw new Error(`Morpho markets response missing pageInfo for network ${network} at skip ${skip}.`);
  }

  if (!Array.isArray(response.data.markets.items)) {
    console.warn(`[Markets] Skipping failed page at skip=${skip} for network ${network}`);
    return null;
  }

  return {
    items: response.data.markets.items.map(processMarketData),
    totalCount: response.data.markets.pageInfo.countTotal,
  };
};

// Fetcher for multiple markets from Morpho API with pagination
export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  const allMarkets: Market[] = [];
  const pageSize = MORPHO_MARKETS_PAGE_SIZE;

  const firstPage = await fetchMorphoMarketsPage(network, 0, pageSize);
  if (!firstPage) {
    return [];
  }

  allMarkets.push(...firstPage.items);

  const firstPageCount = firstPage.items.length;
  const totalCount = firstPage.totalCount;
  if (firstPageCount === 0 && totalCount > 0) {
    console.warn('Received 0 items in the first page, but total count is positive. Returning first-page result only.');
    return filterRegistryMarkets(allMarkets);
  }

  const remainingOffsets: number[] = [];
  for (let nextSkip = firstPageCount; nextSkip < totalCount; nextSkip += pageSize) {
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
      if (settledPage.value) {
        successfulPages.push(settledPage.value);
      }
    }

    successfulPages.forEach((page) => {
      allMarkets.push(...page.items);
    });
  }

  return filterRegistryMarkets(allMarkets);
};
