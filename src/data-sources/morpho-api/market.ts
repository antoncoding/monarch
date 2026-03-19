import { marketDetailQuery, marketsQuery } from '@/graphql/morpho-api-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { blacklistTokens } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';
import { type Address, zeroAddress } from 'viem';

// API response type - matches the new Morpho API shape where oracleAddress is nested
type MorphoApiMarket = Omit<Market, 'oracleAddress' | 'whitelisted'> & {
  oracle: { address: string } | null;
  listed: boolean;
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

type MorphoMarketsPage = {
  items: Market[];
  totalCount: number;
};

const MORPHO_MARKETS_PAGE_SIZE = 600;
const MORPHO_MARKETS_TIMEOUT_MS = 20_000;
const MORPHO_MARKETS_PAGE_BATCH_SIZE = 6;

const filterBlacklistedMarkets = (markets: Market[]): Market[] => {
  return markets.filter(
    (market) =>
      !blacklistTokens.includes(market.collateralAsset?.address.toLowerCase() ?? '') &&
      !blacklistTokens.includes(market.loanAsset?.address.toLowerCase() ?? ''),
  );
};

// Transform API response to internal Market type
const processMarketData = (market: MorphoApiMarket): Market => {
  const { oracle, listed, ...rest } = market;
  return {
    ...rest,
    oracleAddress: (oracle?.address ?? zeroAddress) as Address,
    whitelisted: listed,
    hasUSDPrice: true,
  };
};

const buildRemainingOffsets = (firstPageCount: number, totalCount: number, pageSize: number): number[] => {
  const offsets: number[] = [];

  for (let skip = firstPageCount; skip < totalCount; skip += pageSize) {
    offsets.push(skip);
  }

  return offsets;
};

// Fetcher for market details from Morpho API
export const fetchMorphoMarket = async (uniqueKey: string, network: SupportedNetworks): Promise<Market> => {
  const response = await morphoGraphqlFetcher<MarketGraphQLResponse>(marketDetailQuery, {
    uniqueKey,
    chainId: network,
  });
  if (!response || !response.data || !response.data.marketByUniqueKey) {
    throw new Error('Market data not found in Morpho API response');
  }
  return processMarketData(response.data.marketByUniqueKey);
};

const fetchMorphoMarketsPage = async (
  networks: SupportedNetworks[],
  skip: number,
  pageSize: number,
): Promise<MorphoMarketsPage> => {
  const variables = {
    first: pageSize,
    skip,
    where: {
      chainId_in: networks,
    },
  };

  const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(marketsQuery, variables, {
    timeoutMs: MORPHO_MARKETS_TIMEOUT_MS,
  });

  if (!response || !response.data?.markets?.items || !response.data.markets.pageInfo) {
    throw new Error(`[Markets] Missing or malformed Morpho response at skip=${skip} for networks ${networks.join(',')}`);
  }

  const { items, pageInfo } = response.data.markets;

  return {
    items: items.map(processMarketData),
    totalCount: pageInfo.countTotal,
  };
};

// Fetcher for multiple markets from Morpho API with pagination
export const fetchMorphoMarketsForNetworks = async (networks: SupportedNetworks[]): Promise<Market[]> => {
  if (networks.length === 0) {
    return [];
  }

  const allMarkets: Market[] = [];
  const pageSize = MORPHO_MARKETS_PAGE_SIZE;

  const firstPage = await fetchMorphoMarketsPage(networks, 0, pageSize);

  allMarkets.push(...firstPage.items);

  const firstPageCount = firstPage.items.length;
  const totalCount = firstPage.totalCount;

  if (firstPageCount === 0 && totalCount > 0) {
    console.warn('Received 0 items in the first page, but total count is positive. Returning first-page result only.');
    return filterBlacklistedMarkets(allMarkets);
  }

  // The first page reveals the full count, so we can precompute every remaining offset
  // and fetch the rest in bounded parallel batches instead of strict sequential pagination.
  const remainingOffsets = buildRemainingOffsets(firstPageCount, totalCount, pageSize);

  for (let index = 0; index < remainingOffsets.length; index += MORPHO_MARKETS_PAGE_BATCH_SIZE) {
    const offsetBatch = remainingOffsets.slice(index, index + MORPHO_MARKETS_PAGE_BATCH_SIZE);
    const settledPages = await Promise.allSettled(offsetBatch.map((skip) => fetchMorphoMarketsPage(networks, skip, pageSize)));

    for (const settledPage of settledPages) {
      if (settledPage.status === 'rejected') {
        throw settledPage.reason;
      }

      allMarkets.push(...settledPage.value.items);
    }
  }

  return filterBlacklistedMarkets(allMarkets);
};

export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  return fetchMorphoMarketsForNetworks([network]);
};
