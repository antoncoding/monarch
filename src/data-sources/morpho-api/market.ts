import { marketDetailQuery, marketsQuery } from '@/graphql/morpho-api-queries';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
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

const MORPHO_MARKETS_PAGE_SIZE = 500;
const MORPHO_MARKETS_TIMEOUT_MS = 20_000;
const MORPHO_MARKETS_PAGE_BATCH_SIZE = 4;

// Transform API response to internal Market type
const processMarketData = (market: MorphoApiMarket): Market => {
  const { oracle, listed, ...rest } = market;
  return {
    ...rest,
    oracleAddress: (oracle?.address ?? zeroAddress) as Address,
    whitelisted: listed,
    hasUSDPrice: true,
    usdPriceSource: 'direct',
  };
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

const fetchMorphoMarketsPage = async (network: SupportedNetworks, skip: number, pageSize: number): Promise<MorphoMarketsPage> => {
  return fetchMorphoMarketsPageForChains([network], skip, pageSize);
};

const fetchMorphoMarketsPageForChains = async (
  chainIds: SupportedNetworks[],
  skip: number,
  pageSize: number,
): Promise<MorphoMarketsPage> => {
  const variables = {
    first: pageSize,
    skip,
    where: {
      chainId_in: chainIds,
    },
  };

  const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(marketsQuery, variables, {
    timeoutMs: MORPHO_MARKETS_TIMEOUT_MS,
  });

  if (!response || !response.data?.markets?.items || !response.data.markets.pageInfo) {
    throw new Error(`Morpho markets page is incomplete at skip=${skip} for chains ${chainIds.join(',')}`);
  }

  const { items, pageInfo } = response.data.markets;

  return {
    items: items.map(processMarketData),
    totalCount: pageInfo.countTotal,
  };
};

// Fetcher for multiple markets from Morpho API with pagination
export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  return fetchMorphoMarketsMultiChain([network]);
};

export const fetchMorphoMarketsMultiChain = async (chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS): Promise<Market[]> => {
  const allMarkets: Market[] = [];
  const pageSize = MORPHO_MARKETS_PAGE_SIZE;

  const firstPage = await fetchMorphoMarketsPageForChains(chainIds, 0, pageSize);

  allMarkets.push(...firstPage.items);

  const firstPageCount = firstPage.items.length;
  const totalCount = firstPage.totalCount;

  if (firstPageCount === 0 && totalCount > 0) {
    throw new Error('Morpho markets first page returned zero items despite a positive total count.');
  }

  const remainingOffsets: number[] = [];
  for (let nextSkip = firstPageCount; nextSkip < totalCount; nextSkip += pageSize) {
    remainingOffsets.push(nextSkip);
  }

  for (let index = 0; index < remainingOffsets.length; index += MORPHO_MARKETS_PAGE_BATCH_SIZE) {
    const offsetBatch = remainingOffsets.slice(index, index + MORPHO_MARKETS_PAGE_BATCH_SIZE);
    const settledPages = await Promise.allSettled(offsetBatch.map((skip) => fetchMorphoMarketsPageForChains(chainIds, skip, pageSize)));

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

  // final filter: remove scam markets
  return allMarkets.filter(
    (market) =>
      !blacklistTokens.includes(market.collateralAsset?.address.toLowerCase() ?? '') &&
      !blacklistTokens.includes(market.loanAsset?.address.toLowerCase() ?? ''),
  );
};
