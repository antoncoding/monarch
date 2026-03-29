import { supportsMorphoApi } from '@/config/dataSources';
import { marketsWhitelistStatusQuery } from '@/graphql/morpho-api-queries';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import { morphoGraphqlFetcher } from './fetchers';

type MorphoWhitelistMarket = {
  uniqueKey: string;
  listed: boolean;
  supplyingVaults?: {
    address: string | null;
  }[];
  morphoBlue: {
    chain: {
      id: number;
    };
  };
};

type MorphoWhitelistStatusResponse = {
  data?: {
    markets?: {
      items?: MorphoWhitelistMarket[];
      pageInfo?: {
        countTotal: number;
      };
    };
  };
  errors?: { message: string }[];
};

type MorphoWhitelistStatusPage = {
  items: MorphoMarketMetadata[];
  totalCount: number;
};

export type MorphoWhitelistStatus = {
  chainId: number;
  uniqueKey: string;
  listed: boolean;
};

export type MorphoMarketMetadata = MorphoWhitelistStatus & {
  supplyingVaults: {
    address: string;
  }[];
};

export type MorphoWhitelistStatusRefresh = {
  network: SupportedNetworks;
  statuses: MorphoWhitelistStatus[];
};

export type MorphoMarketMetadataRefresh = {
  network: SupportedNetworks;
  metadata: MorphoMarketMetadata[];
};

// The combined `listed + supplyingVaults` markets query costs 1095 complexity per row on Morpho API.
// Keep a small buffer below the 1,000,000 complexity cap to avoid provider-side 500/403 failures.
const MORPHO_WHITELIST_PAGE_SIZE = 900;
const MORPHO_WHITELIST_TIMEOUT_MS = 15_000;
const MORPHO_WHITELIST_PAGE_BATCH_SIZE = 4;

const MORPHO_SUPPORTED_NETWORKS = ALL_SUPPORTED_NETWORKS.filter((network) => supportsMorphoApi(network));

const normalizeSupplyingVaults = (supplyingVaults: MorphoWhitelistMarket['supplyingVaults']): MorphoMarketMetadata['supplyingVaults'] => {
  const uniqueVaults = new Set<string>();
  const normalizedVaults: MorphoMarketMetadata['supplyingVaults'] = [];

  supplyingVaults?.forEach((vault) => {
    const address = vault.address?.toLowerCase();
    if (!address || uniqueVaults.has(address)) {
      return;
    }

    uniqueVaults.add(address);
    normalizedVaults.push({ address });
  });

  return normalizedVaults;
};

const fetchMorphoMarketMetadataPage = async (
  network: SupportedNetworks,
  skip: number,
  pageSize: number,
): Promise<MorphoWhitelistStatusPage | null> => {
  const response = await morphoGraphqlFetcher<MorphoWhitelistStatusResponse>(
    marketsWhitelistStatusQuery,
    {
      first: pageSize,
      skip,
      where: {
        chainId_in: [network],
      },
    },
    {
      timeoutMs: MORPHO_WHITELIST_TIMEOUT_MS,
    },
  );

  if (!response?.data?.markets?.items || !response.data.markets.pageInfo) {
    console.warn(`[WhitelistStatus] Skipping failed page at skip=${skip} for network ${network}`);
    return null;
  }

  return {
    items: response.data.markets.items.map((market) => ({
      chainId: market.morphoBlue.chain.id,
      uniqueKey: market.uniqueKey,
      listed: market.listed,
      supplyingVaults: normalizeSupplyingVaults(market.supplyingVaults),
    })),
    totalCount: response.data.markets.pageInfo.countTotal,
  };
};

const fetchMorphoMarketMetadataForNetwork = async (network: SupportedNetworks): Promise<MorphoMarketMetadata[]> => {
  const firstPage = await fetchMorphoMarketMetadataPage(network, 0, MORPHO_WHITELIST_PAGE_SIZE);
  if (!firstPage) {
    throw new Error(`[WhitelistStatus] Failed to fetch first page for network ${network}.`);
  }

  const allMetadata = [...firstPage.items];
  const firstPageCount = firstPage.items.length;
  const totalCount = firstPage.totalCount;

  if (firstPageCount === 0 && totalCount > 0) {
    throw new Error(`[WhitelistStatus] Received empty first page for network ${network} while totalCount=${totalCount}.`);
  }

  const remainingOffsets: number[] = [];
  for (let nextSkip = firstPageCount; nextSkip < totalCount; nextSkip += MORPHO_WHITELIST_PAGE_SIZE) {
    remainingOffsets.push(nextSkip);
  }

  for (let index = 0; index < remainingOffsets.length; index += MORPHO_WHITELIST_PAGE_BATCH_SIZE) {
    const offsetBatch = remainingOffsets.slice(index, index + MORPHO_WHITELIST_PAGE_BATCH_SIZE);
    const settledPages = await Promise.allSettled(
      offsetBatch.map((skip) => fetchMorphoMarketMetadataPage(network, skip, MORPHO_WHITELIST_PAGE_SIZE)),
    );

    for (const settledPage of settledPages) {
      if (settledPage.status === 'rejected') {
        throw settledPage.reason;
      }
      if (!settledPage.value) {
        throw new Error(`[WhitelistStatus] Failed to fetch one of the paginated whitelist pages for network ${network}.`);
      }

      allMetadata.push(...settledPage.value.items);
    }
  }

  if (allMetadata.length < totalCount) {
    throw new Error(
      `[WhitelistStatus] Incomplete whitelist dataset for network ${network}: fetched ${allMetadata.length} of ${totalCount}.`,
    );
  }

  return allMetadata;
};

export const fetchAllMorphoMarketMetadata = async (): Promise<MorphoMarketMetadataRefresh[]> => {
  const settledResults = await Promise.allSettled(
    MORPHO_SUPPORTED_NETWORKS.map(async (network) => ({
      network,
      metadata: await fetchMorphoMarketMetadataForNetwork(network),
    })),
  );
  const successfulRefreshes: MorphoMarketMetadataRefresh[] = [];

  for (const settledResult of settledResults) {
    if (settledResult.status === 'rejected') {
      console.warn('[WhitelistStatus] Failed to fetch one network; continuing with cached/partial data.', settledResult.reason);
      continue;
    }

    const metadataByKey = new Map<string, MorphoMarketMetadata>();
    for (const metadata of settledResult.value.metadata) {
      metadataByKey.set(getMarketIdentityKey(metadata.chainId, metadata.uniqueKey), metadata);
    }

    successfulRefreshes.push({
      network: settledResult.value.network,
      metadata: Array.from(metadataByKey.values()),
    });
  }

  return successfulRefreshes;
};
