import { marketDetailQuery, marketsQuery } from '@/graphql/morpho-api-queries';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
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

const MORPHO_MARKETS_PAGE_SIZE = 500;
const MORPHO_MARKETS_FALLBACK_TIMEOUT_MS = 10_000;
const MORPHO_MARKETS_NO_FALLBACK_TIMEOUT_MS = 20_000;
const MORPHO_MARKETS_PAGE_BATCH_SIZE = 4;
const shouldLogMorphoMarketsPerf = process.env.NODE_ENV !== 'production';

const getMorphoMarketsTimeoutMs = (network: SupportedNetworks): number => {
  return getSubgraphUrl(network) ? MORPHO_MARKETS_FALLBACK_TIMEOUT_MS : MORPHO_MARKETS_NO_FALLBACK_TIMEOUT_MS;
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

const fetchMorphoMarketsPage = async (network: SupportedNetworks, skip: number, pageSize: number): Promise<MorphoMarketsPage | null> => {
  if (shouldLogMorphoMarketsPerf) {
    console.info(`[Markets] Fetching page skip=${skip}, pageSize=${pageSize} for network ${network}`);
  }

  const variables = {
    first: pageSize,
    skip,
    where: {
      chainId_in: [network],
    },
  };

  const response = await morphoGraphqlFetcher<MarketsGraphQLResponse>(marketsQuery, variables, {
    timeoutMs: getMorphoMarketsTimeoutMs(network),
  });

  if (!response || !response.data?.markets?.items || !response.data.markets.pageInfo) {
    console.warn(`[Markets] Skipping failed page at skip=${skip} for network ${network}`);
    return null;
  }

  const { items, pageInfo } = response.data.markets;

  return {
    items: items.map(processMarketData),
    totalCount: pageInfo.countTotal,
  };
};

// Fetcher for multiple markets from Morpho API with pagination
export const fetchMorphoMarkets = async (network: SupportedNetworks): Promise<Market[]> => {
  const allMarkets: Market[] = [];
  const pageSize = MORPHO_MARKETS_PAGE_SIZE;

  try {
    const firstPage = await fetchMorphoMarketsPage(network, 0, pageSize);

    if (!firstPage) {
      return [];
    }

    allMarkets.push(...firstPage.items);

    const firstPageCount = firstPage.items.length;
    const totalCount = firstPage.totalCount;
    if (shouldLogMorphoMarketsPerf) {
      console.info(`[Markets] First page fetched ${firstPageCount} markets for network ${network}, total=${totalCount}`);
    }

    if (firstPageCount === 0 && totalCount > 0) {
      console.warn('Received 0 items in the first page, but total count is positive. Returning first-page result only.');
      return allMarkets.filter(
        (market) =>
          !blacklistTokens.includes(market.collateralAsset?.address.toLowerCase() ?? '') &&
          !blacklistTokens.includes(market.loanAsset?.address.toLowerCase() ?? ''),
      );
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

      if (shouldLogMorphoMarketsPerf) {
        console.info(`[Markets] Parallel batch fetched ${successfulPages.length} pages for network ${network}, total so far: ${allMarkets.length}/${totalCount}`);
      }
    }

    if (shouldLogMorphoMarketsPerf) {
      console.info(
        `[Markets] Completed fetching all markets for network ${network}. Total requests: ${remainingOffsets.length + 1}, Total markets: ${allMarkets.length}`,
      );
    }

    // final filter: remove scam markets
    return allMarkets.filter(
      (market) =>
        !blacklistTokens.includes(market.collateralAsset?.address.toLowerCase() ?? '') &&
        !blacklistTokens.includes(market.loanAsset?.address.toLowerCase() ?? ''),
    );
  } catch (error) {
    console.error(`Error fetching markets via Morpho API for network ${network}:`, error);
    throw error;
  }
};
