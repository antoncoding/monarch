import { AdaptiveCurveIrmLib, Market as BlueMarket, MarketParams as BlueMarketParams, MarketUtils } from '@morpho-org/blue-sdk';
import { type Address, formatUnits, zeroAddress } from 'viem';
import { envioMarketsQuery } from '@/graphql/envio-queries';
import { fetchTokenMetadataMap } from '@/data-sources/shared/token-metadata';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { isForceUnwhitelisted } from '@/utils/markets';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import { getMorphoAddress } from '@/utils/morpho';
import { blacklistTokens, infoToKey } from '@/utils/tokens';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks, isSupportedChain } from '@/utils/networks';
import type { Market, TokenInfo } from '@/utils/types';
import { isTokenBlacklistedMarket } from '../shared/market-visibility';
import { envioGraphqlFetcher } from './fetchers';

type EnvioMarketRow = {
  chainId: number;
  marketId: string;
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: string | number;
  fee: string | number;
  lastUpdate: string | number;
  rateAtTarget: string | number;
  totalSupplyAssets: string | number;
  totalSupplyShares: string | number;
  totalBorrowAssets: string | number;
  totalBorrowShares: string | number;
};

type EnvioMarketsResponse = {
  data?: {
    Market?: EnvioMarketRow[];
  };
};

const ENVIO_MARKETS_PAGE_SIZE = 1000;
const ENVIO_MARKETS_PAGE_BATCH_SIZE = 4;
const ENVIO_MARKETS_TIMEOUT_MS = 20_000;

const normalizeAddress = (value: string | number | null | undefined): Address => {
  if (typeof value !== 'string') return zeroAddress;
  return (value || zeroAddress) as Address;
};

const normalizeString = (value: string | number | null | undefined): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return '0';
};

const normalizeTimestamp = (value: string | number | null | undefined): number => {
  const normalized = normalizeString(value);
  try {
    return Number(BigInt(normalized));
  } catch {
    return 0;
  }
};

const normalizeRateAtTarget = (value: string | number | null | undefined): bigint => {
  try {
    const parsed = BigInt(normalizeString(value));
    return parsed > 0n ? parsed : AdaptiveCurveIrmLib.INITIAL_RATE_AT_TARGET;
  } catch {
    return AdaptiveCurveIrmLib.INITIAL_RATE_AT_TARGET;
  }
};

const toFallbackTokenInfo = (address: string, chainId: SupportedNetworks): TokenInfo => {
  return {
    address,
    decimals: 18,
    id: infoToKey(address, chainId),
    name: 'Unknown Token',
    symbol: 'Unknown',
  };
};

const withVisibleMarketsFilter = (where: Record<string, unknown>): Record<string, unknown> => {
  return {
    _and: [
      where,
      {
        collateralToken: {
          _neq: zeroAddress,
          _nin: blacklistTokens,
        },
      },
      {
        loanToken: {
          _neq: zeroAddress,
          _nin: blacklistTokens,
        },
      },
      {
        irm: {
          _neq: zeroAddress,
        },
      },
    ],
  };
};

const hasExcludedEnvioAddresses = (market: EnvioMarketRow): boolean => {
  return (
    normalizeAddress(market.loanToken) === zeroAddress ||
    normalizeAddress(market.collateralToken) === zeroAddress ||
    normalizeAddress(market.irm) === zeroAddress
  );
};

const fetchEnvioMarketsPage = async ({
  limit,
  offset,
  where,
}: {
  limit: number;
  offset: number;
  where: Record<string, unknown>;
}): Promise<EnvioMarketRow[]> => {
  const response = await envioGraphqlFetcher<EnvioMarketsResponse>(
    envioMarketsQuery,
    {
      limit,
      offset,
      where: withVisibleMarketsFilter(where),
    },
    {
      timeoutMs: ENVIO_MARKETS_TIMEOUT_MS,
    },
  );

  return response.data?.Market ?? [];
};

const buildEnvioMarket = (market: EnvioMarketRow, tokenMetadataMap: Map<string, TokenInfo>): Market | null => {
  if (!isSupportedChain(market.chainId)) {
    return null;
  }

  const chainId = market.chainId as SupportedNetworks;
  const loanTokenAddress = normalizeAddress(market.loanToken);
  const collateralTokenAddress = normalizeAddress(market.collateralToken);
  const oracleAddress = normalizeAddress(market.oracle);
  const irmAddress = normalizeAddress(market.irm);
  const uniqueKey = normalizeString(market.marketId);
  const totalSupplyAssets = normalizeString(market.totalSupplyAssets);
  const totalSupplyShares = normalizeString(market.totalSupplyShares);
  const totalBorrowAssets = normalizeString(market.totalBorrowAssets);
  const totalBorrowShares = normalizeString(market.totalBorrowShares);
  const lastUpdate = normalizeTimestamp(market.lastUpdate);
  const loanAsset = tokenMetadataMap.get(infoToKey(loanTokenAddress, chainId)) ?? toFallbackTokenInfo(loanTokenAddress, chainId);
  const collateralAsset =
    tokenMetadataMap.get(infoToKey(collateralTokenAddress, chainId)) ?? toFallbackTokenInfo(collateralTokenAddress, chainId);

  try {
    const rawFee = normalizeString(market.fee);
    const fee = Number(formatUnits(BigInt(rawFee), 18));
    const rateAtTarget = normalizeRateAtTarget(market.rateAtTarget);
    const blueMarket = new BlueMarket({
      params: new BlueMarketParams({
        loanToken: loanTokenAddress,
        collateralToken: collateralTokenAddress,
        oracle: oracleAddress,
        irm: irmAddress,
        lltv: BigInt(normalizeString(market.lltv)),
      }),
      totalSupplyAssets: BigInt(totalSupplyAssets),
      totalBorrowAssets: BigInt(totalBorrowAssets),
      totalSupplyShares: BigInt(totalSupplyShares),
      totalBorrowShares: BigInt(totalBorrowShares),
      lastUpdate: BigInt(lastUpdate),
      fee: BigInt(rawFee),
      rateAtTarget,
    });

    return {
      id: uniqueKey,
      uniqueKey,
      lltv: normalizeString(market.lltv),
      irmAddress,
      oracleAddress,
      whitelisted: !isForceUnwhitelisted(uniqueKey),
      loanAsset,
      collateralAsset,
      morphoBlue: {
        id: getMorphoAddress(chainId),
        address: getMorphoAddress(chainId),
        chain: {
          id: chainId,
        },
      },
      state: {
        borrowAssets: totalBorrowAssets,
        supplyAssets: totalSupplyAssets,
        borrowShares: totalBorrowShares,
        supplyShares: totalSupplyShares,
        liquidityAssets: blueMarket.liquidity.toString(),
        collateralAssets: '0',
        borrowAssetsUsd: 0,
        supplyAssetsUsd: 0,
        liquidityAssetsUsd: 0,
        collateralAssetsUsd: null,
        utilization: Number(blueMarket.utilization) / 1e18,
        supplyApy: blueMarket.supplyApy,
        borrowApy: blueMarket.borrowApy,
        fee,
        timestamp: lastUpdate,
        apyAtTarget: MarketUtils.rateToApy(rateAtTarget),
        rateAtTarget: rateAtTarget.toString(),
        dailySupplyApy: null,
        dailyBorrowApy: null,
        weeklySupplyApy: null,
        weeklyBorrowApy: null,
        monthlySupplyApy: null,
        monthlyBorrowApy: null,
      },
      warnings: [],
      hasUSDPrice: false,
      usdPriceSource: 'none',
      realizedBadDebt: {
        underlying: '0',
      },
      supplyingVaults: [],
    };
  } catch (error) {
    console.error(`[envio] Failed to map market ${getChainScopedMarketKey(uniqueKey, chainId)}:`, error);
    return null;
  }
};

const toMarketTokenRefs = (markets: EnvioMarketRow[]): { address: string; chainId: SupportedNetworks }[] => {
  const tokenRefs: { address: string; chainId: SupportedNetworks }[] = [];

  for (const market of markets) {
    if (!isSupportedChain(market.chainId)) {
      continue;
    }

    const chainId = market.chainId as SupportedNetworks;
    tokenRefs.push(
      {
        address: normalizeAddress(market.loanToken),
        chainId,
      },
      {
        address: normalizeAddress(market.collateralToken),
        chainId,
      },
    );
  }

  return tokenRefs;
};

const buildEnvioMarketsMap = async (
  rows: EnvioMarketRow[],
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<Map<string, Market>> => {
  const visibleRows = rows.filter((market) => !hasExcludedEnvioAddresses(market) && !isTokenBlacklistedMarket(market));
  const tokenMetadataMap = await fetchTokenMetadataMap(toMarketTokenRefs(visibleRows), options.customRpcUrls);
  const marketsByKey = new Map<string, Market>();

  for (const row of visibleRows) {
    const market = buildEnvioMarket(row, tokenMetadataMap);

    if (!market) {
      throw new Error(`Failed to map Envio market ${getChainScopedMarketKey(normalizeString(row.marketId), row.chainId)}`);
    }

    marketsByKey.set(getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id), market);
  }

  return marketsByKey;
};

export const fetchEnvioMarkets = async (
  chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS,
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<Market[]> => {
  const rows: EnvioMarketRow[] = [];

  for (let offset = 0; ; offset += ENVIO_MARKETS_PAGE_SIZE * ENVIO_MARKETS_PAGE_BATCH_SIZE) {
    const offsets = Array.from({ length: ENVIO_MARKETS_PAGE_BATCH_SIZE }, (_, index) => offset + index * ENVIO_MARKETS_PAGE_SIZE);
    const pages = await Promise.all(
      offsets.map((currentOffset) =>
        fetchEnvioMarketsPage({
          limit: ENVIO_MARKETS_PAGE_SIZE,
          offset: currentOffset,
          where: {
            chainId: {
              _in: chainIds,
            },
          },
        }),
      ),
    );

    let reachedEnd = false;

    for (const page of pages) {
      if (page.length === 0) {
        reachedEnd = true;
        break;
      }

      rows.push(...page);

      if (page.length < ENVIO_MARKETS_PAGE_SIZE) {
        reachedEnd = true;
        break;
      }
    }

    if (reachedEnd) {
      break;
    }
  }

  return Array.from((await buildEnvioMarketsMap(rows, options)).values());
};

export const fetchEnvioMarketsByKeys = async (
  marketRequests: { marketUniqueKey: string; chainId: SupportedNetworks }[],
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<Map<string, Market>> => {
  if (marketRequests.length === 0) {
    return new Map<string, Market>();
  }

  const uniqueRequests = new Map<string, { marketUniqueKey: string; chainId: SupportedNetworks }>();

  for (const marketRequest of marketRequests) {
    uniqueRequests.set(getChainScopedMarketKey(marketRequest.marketUniqueKey, marketRequest.chainId), marketRequest);
  }

  const rows = await fetchEnvioMarketsPage({
    limit: uniqueRequests.size,
    offset: 0,
    where: {
      _or: Array.from(uniqueRequests.values()).map((marketRequest) => ({
        chainId: {
          _eq: marketRequest.chainId,
        },
        marketId: {
          _eq: marketRequest.marketUniqueKey.toLowerCase(),
        },
      })),
    },
  });

  const requestedKeys = new Set(uniqueRequests.keys());
  const filteredRows = rows.filter((market) => requestedKeys.has(getChainScopedMarketKey(normalizeString(market.marketId), market.chainId)));
  return buildEnvioMarketsMap(filteredRows, options);
};

export const fetchEnvioMarket = async (
  uniqueKey: string,
  chainId: SupportedNetworks,
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<Market | null> => {
  const marketMap = await fetchEnvioMarketsByKeys([
    {
      marketUniqueKey: uniqueKey,
      chainId,
    },
  ], options);

  return marketMap.get(getChainScopedMarketKey(uniqueKey, chainId)) ?? null;
};
