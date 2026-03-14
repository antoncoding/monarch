import { marketMetadataDetailQuery, marketsMetadataQuery } from '@/graphql/morpho-api-queries';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import type { MarketMetadata, MarketWarning } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

type MorphoApiMarketMetadata = {
  uniqueKey: string;
  morphoBlue: {
    chain: {
      id: SupportedNetworks;
    };
  };
  warnings?: MarketWarning[] | null;
  supplyingVaults?: {
    address: string;
  }[] | null;
};

type MarketMetadataGraphQLResponse = {
  data?: {
    marketByUniqueKey?: MorphoApiMarketMetadata | null;
  };
};

type MarketsMetadataGraphQLResponse = {
  data?: {
    markets?: {
      items?: MorphoApiMarketMetadata[];
      pageInfo?: {
        countTotal: number;
      };
    };
  };
};

type MorphoMarketMetadataPage = {
  items: MarketMetadata[];
  totalCount: number;
};

const MORPHO_MARKET_METADATA_PAGE_SIZE = 500;
const MORPHO_MARKET_METADATA_PAGE_BATCH_SIZE = 4;
const MORPHO_MARKET_METADATA_TIMEOUT_MS = 20_000;

const toMarketMetadata = (market: MorphoApiMarketMetadata): MarketMetadata => {
  return {
    uniqueKey: market.uniqueKey,
    chainId: market.morphoBlue.chain.id,
    warnings: market.warnings ?? [],
    supplyingVaults: market.supplyingVaults ?? [],
  };
};

export const fetchMorphoMarketMetadata = async (
  uniqueKey: string,
  chainId: SupportedNetworks,
): Promise<MarketMetadata | null> => {
  const response = await morphoGraphqlFetcher<MarketMetadataGraphQLResponse>(marketMetadataDetailQuery, {
    uniqueKey,
    chainId,
  });

  return response?.data?.marketByUniqueKey ? toMarketMetadata(response.data.marketByUniqueKey) : null;
};

const fetchMorphoMarketsMetadataPageForChains = async (
  chainIds: SupportedNetworks[],
  skip: number,
  pageSize: number,
): Promise<MorphoMarketMetadataPage> => {
  const response = await morphoGraphqlFetcher<MarketsMetadataGraphQLResponse>(
    marketsMetadataQuery,
    {
      first: pageSize,
      skip,
      where: {
        chainId_in: chainIds,
      },
    },
    {
      timeoutMs: MORPHO_MARKET_METADATA_TIMEOUT_MS,
    },
  );

  if (!response?.data?.markets?.items || !response.data.markets.pageInfo) {
    throw new Error(`Morpho market metadata page is incomplete at skip=${skip} for chains ${chainIds.join(',')}`);
  }

  return {
    items: response.data.markets.items.map(toMarketMetadata),
    totalCount: response.data.markets.pageInfo.countTotal,
  };
};

export const fetchMorphoMarketsMetadataMultiChain = async (
  chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS,
): Promise<Map<string, MarketMetadata>> => {
  const metadataByKey = new Map<string, MarketMetadata>();
  const firstPage = await fetchMorphoMarketsMetadataPageForChains(chainIds, 0, MORPHO_MARKET_METADATA_PAGE_SIZE);

  for (const metadata of firstPage.items) {
    metadataByKey.set(getChainScopedMarketKey(metadata.uniqueKey, metadata.chainId), metadata);
  }

  const firstPageCount = firstPage.items.length;
  const totalCount = firstPage.totalCount;

  if (firstPageCount === 0 && totalCount > 0) {
    throw new Error('Morpho market metadata first page returned zero items despite a positive total count.');
  }

  const remainingOffsets: number[] = [];
  for (let nextSkip = firstPageCount; nextSkip < totalCount; nextSkip += MORPHO_MARKET_METADATA_PAGE_SIZE) {
    remainingOffsets.push(nextSkip);
  }

  for (let index = 0; index < remainingOffsets.length; index += MORPHO_MARKET_METADATA_PAGE_BATCH_SIZE) {
    const offsetBatch = remainingOffsets.slice(index, index + MORPHO_MARKET_METADATA_PAGE_BATCH_SIZE);
    const settledPages = await Promise.allSettled(
      offsetBatch.map((skip) => fetchMorphoMarketsMetadataPageForChains(chainIds, skip, MORPHO_MARKET_METADATA_PAGE_SIZE)),
    );

    for (const settledPage of settledPages) {
      if (settledPage.status === 'rejected') {
        throw settledPage.reason;
      }

      for (const metadata of settledPage.value.items) {
        metadataByKey.set(getChainScopedMarketKey(metadata.uniqueKey, metadata.chainId), metadata);
      }
    }
  }

  return metadataByKey;
};
