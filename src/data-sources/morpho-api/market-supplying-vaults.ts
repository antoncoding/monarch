import { marketSupplyingVaultsQuery } from '@/graphql/morpho-api-queries';
import { getChainScopedMarketKey } from '@/utils/markets';
import { morphoGraphqlFetcher } from './fetchers';

type MarketReference = {
  uniqueKey: string;
  chainId: number;
};

type MarketSupplyingVaultsResponse = {
  data?: {
    markets?: {
      items?: Array<{
        uniqueKey?: string;
        morphoBlue?: {
          chain?: {
            id?: number;
          };
        };
        supplyingVaults?: Array<{
          address?: string | null;
        }> | null;
      }>;
    };
  };
  errors?: { message: string }[];
};

const SUPPLYING_VAULTS_CHUNK_SIZE = 200;
const SUPPLYING_VAULTS_BATCH_SIZE = 4;
const SUPPLYING_VAULTS_TIMEOUT_MS = 15_000;

const dedupeMarketReferences = (markets: MarketReference[]): MarketReference[] => {
  const uniqueMarkets = new Map<string, MarketReference>();

  for (const market of markets) {
    if (!market.uniqueKey) {
      continue;
    }

    uniqueMarkets.set(getChainScopedMarketKey(market.chainId, market.uniqueKey), {
      uniqueKey: market.uniqueKey,
      chainId: market.chainId,
    });
  }

  return Array.from(uniqueMarkets.values());
};

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const fetchSupplyingVaultsChunk = async (markets: MarketReference[]): Promise<Map<string, string[]>> => {
  const result = await morphoGraphqlFetcher<MarketSupplyingVaultsResponse>(
    marketSupplyingVaultsQuery,
    {
      first: markets.length,
      where: {
        uniqueKey_in: markets.map((market) => market.uniqueKey),
        chainId_in: [...new Set(markets.map((market) => market.chainId))],
      },
    },
    {
      timeoutMs: SUPPLYING_VAULTS_TIMEOUT_MS,
    },
  );

  const supplyingVaultsByMarket = new Map<string, string[]>();

  if (!result) {
    return supplyingVaultsByMarket;
  }

  for (const item of result.data?.markets?.items ?? []) {
    const uniqueKey = item.uniqueKey;
    const chainId = item.morphoBlue?.chain?.id;

    if (!uniqueKey || chainId === undefined) {
      continue;
    }

    const vaultAddresses = Array.from(
      new Set(
        (item.supplyingVaults ?? [])
          .map((vault) => vault.address?.toLowerCase())
          .filter((address): address is string => Boolean(address)),
      ),
    );

    supplyingVaultsByMarket.set(getChainScopedMarketKey(chainId, uniqueKey), vaultAddresses);
  }

  return supplyingVaultsByMarket;
};

export const fetchMarketSupplyingVaults = async (markets: MarketReference[]): Promise<Map<string, string[]>> => {
  const uniqueMarkets = dedupeMarketReferences(markets);
  if (uniqueMarkets.length === 0) {
    return new Map();
  }

  const supplyingVaultsByMarket = new Map<string, string[]>();
  const marketChunks = chunkArray(uniqueMarkets, SUPPLYING_VAULTS_CHUNK_SIZE);

  for (let index = 0; index < marketChunks.length; index += SUPPLYING_VAULTS_BATCH_SIZE) {
    const chunkBatch = marketChunks.slice(index, index + SUPPLYING_VAULTS_BATCH_SIZE);
    const results = await Promise.allSettled(chunkBatch.map((chunk) => fetchSupplyingVaultsChunk(chunk)));

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        throw result.reason;
      }

      for (const [marketKey, vaultAddresses] of result.value.entries()) {
        supplyingVaultsByMarket.set(marketKey, vaultAddresses);
      }
    }
  }

  for (const market of uniqueMarkets) {
    const marketKey = getChainScopedMarketKey(market.chainId, market.uniqueKey);
    if (!supplyingVaultsByMarket.has(marketKey)) {
      supplyingVaultsByMarket.set(marketKey, []);
    }
  }

  return supplyingVaultsByMarket;
};

export type { MarketReference };
