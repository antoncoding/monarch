import { Market as BlueMarket, MarketParams as BlueMarketParams } from '@morpho-org/blue-sdk';
import { formatUnits, type Address, zeroAddress } from 'viem';
import { buildEnvioMarketsPageQuery, envioMarketByIdQuery } from '@/graphql/envio-queries';
import { isMarketRegistryEntryAllowed } from '@/utils/markets';
import { getMorphoAddress } from '@/utils/morpho';
import { isSupportedChain, type SupportedNetworks } from '@/utils/networks';
import { infoToKey } from '@/utils/tokens';
import { resolveTokenInfos, type ResolvedTokenInfo, type TokenAddressInput } from '@/utils/tokenMetadata';
import type { Market, MarketWarning } from '@/utils/types';
import { UNRECOGNIZED_COLLATERAL, UNRECOGNIZED_LOAN } from '@/utils/warnings';
import { monarchGraphqlFetcher } from './fetchers';

type MonarchMarketRow = {
  chainId: number;
  marketId: string;
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: string;
  totalSupplyAssets: string;
  totalBorrowAssets: string;
  totalSupplyShares: string;
  totalBorrowShares: string;
  collateralAssets: string;
  lastUpdate: string;
  fee: string;
  rateAtTarget: string;
};

type MonarchMarketsPageResponse = {
  data?: {
    Market?: MonarchMarketRow[];
  };
};

const MONARCH_MARKETS_PAGE_SIZE = 1_000;
const MONARCH_MARKETS_TIMEOUT_MS = 15_000;
const MONARCH_MARKETS_ZERO_ADDRESS = zeroAddress.toLowerCase();

const normalizeAddress = (value: string): string => value.toLowerCase();

const toMarketWarnings = (loanAssetRecognized: boolean, collateralAssetRecognized: boolean): MarketWarning[] => {
  const warnings: MarketWarning[] = [];

  if (!loanAssetRecognized) {
    warnings.push(UNRECOGNIZED_LOAN);
  }

  if (!collateralAssetRecognized) {
    warnings.push(UNRECOGNIZED_COLLATERAL);
  }

  return warnings;
};

const toMarketState = (market: MonarchMarketRow) => {
  const params = new BlueMarketParams({
    loanToken: normalizeAddress(market.loanToken) as Address,
    collateralToken: normalizeAddress(market.collateralToken) as Address,
    oracle: normalizeAddress(market.oracle) as Address,
    irm: normalizeAddress(market.irm) as Address,
    lltv: BigInt(market.lltv),
  });
  const fee = BigInt(market.fee);
  const blueMarket = new BlueMarket({
    params,
    totalSupplyAssets: BigInt(market.totalSupplyAssets),
    totalBorrowAssets: BigInt(market.totalBorrowAssets),
    totalSupplyShares: BigInt(market.totalSupplyShares),
    totalBorrowShares: BigInt(market.totalBorrowShares),
    lastUpdate: BigInt(market.lastUpdate),
    fee,
    rateAtTarget: BigInt(market.rateAtTarget),
  });
  const effectiveTimestamp = BigInt(Math.max(Number(market.lastUpdate), Math.floor(Date.now() / 1000)));

  return {
    borrowAssets: market.totalBorrowAssets,
    supplyAssets: market.totalSupplyAssets,
    borrowAssetsUsd: 0,
    supplyAssetsUsd: 0,
    borrowShares: market.totalBorrowShares,
    supplyShares: market.totalSupplyShares,
    liquidityAssets: blueMarket.liquidity.toString(),
    liquidityAssetsUsd: 0,
    collateralAssets: market.collateralAssets,
    collateralAssetsUsd: null,
    utilization: Number(blueMarket.utilization) / 1e18,
    supplyApy: blueMarket.getSupplyApy(effectiveTimestamp),
    borrowApy: blueMarket.getBorrowApy(effectiveTimestamp),
    fee: Number(formatUnits(fee, 18)),
    timestamp: Number(market.lastUpdate),
    apyAtTarget: blueMarket.apyAtTarget ?? 0,
    rateAtTarget: market.rateAtTarget,
    dailySupplyApy: null,
    dailyBorrowApy: null,
    weeklySupplyApy: null,
    weeklyBorrowApy: null,
    monthlySupplyApy: null,
    monthlyBorrowApy: null,
  };
};

const getMarketTokenInputs = (markets: MonarchMarketRow[]): TokenAddressInput[] => {
  const tokens: TokenAddressInput[] = [];

  for (const market of markets) {
    if (!isSupportedChain(market.chainId)) {
      continue;
    }

    const chainId = market.chainId as SupportedNetworks;
    tokens.push(
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

  return tokens;
};

const mapMonarchMarketToMarket = (market: MonarchMarketRow, tokenInfos: Map<string, ResolvedTokenInfo>): Market | null => {
  if (!isSupportedChain(market.chainId)) {
    return null;
  }

  const chainId = market.chainId as SupportedNetworks;
  const loanAssetAddress = normalizeAddress(market.loanToken);
  const collateralAssetAddress = normalizeAddress(market.collateralToken);

  if (
    !isMarketRegistryEntryAllowed({
      loanAssetAddress,
      collateralAssetAddress,
      irmAddress: market.irm,
    })
  ) {
    return null;
  }

  const loanAsset = tokenInfos.get(infoToKey(loanAssetAddress, chainId));
  const collateralAsset = tokenInfos.get(infoToKey(collateralAssetAddress, chainId));

  if (!loanAsset || !collateralAsset) {
    console.warn(`Skipping Monarch market ${market.marketId} on chain ${chainId}: token decimals could not be resolved.`);
    return null;
  }

  return {
    id: normalizeAddress(market.marketId),
    uniqueKey: normalizeAddress(market.marketId),
    lltv: market.lltv,
    irmAddress: normalizeAddress(market.irm),
    oracleAddress: normalizeAddress(market.oracle) as Address,
    whitelisted: true,
    morphoBlue: {
      id: getMorphoAddress(chainId),
      address: getMorphoAddress(chainId),
      chain: {
        id: chainId,
      },
    },
    loanAsset: loanAsset.token,
    collateralAsset: collateralAsset.token,
    state: toMarketState(market),
    realizedBadDebt: {
      underlying: '0',
    },
    supplyingVaults: [],
    hasUSDPrice: false,
    warnings: toMarketWarnings(loanAsset.isRecognized, collateralAsset.isRecognized),
  };
};

const fetchMonarchMarketsPage = async (query: string, variables: Record<string, unknown>): Promise<MonarchMarketRow[]> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MONARCH_MARKETS_TIMEOUT_MS);

  try {
    const response = await monarchGraphqlFetcher<MonarchMarketsPageResponse>(query, variables, {
      signal: controller.signal,
    });

    return response.data?.Market ?? [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Monarch markets request timed out after ${MONARCH_MARKETS_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const mapMonarchMarketRows = async (rows: MonarchMarketRow[]): Promise<Market[]> => {
  if (rows.length === 0) {
    return [];
  }

  const tokenInfos = await resolveTokenInfos(getMarketTokenInputs(rows));

  return rows.map((market) => mapMonarchMarketToMarket(market, tokenInfos)).filter((market): market is Market => market !== null);
};

// If `network` is omitted, this fetches the merged multi-chain market registry in one query path.
export const fetchMonarchMarkets = async (network?: SupportedNetworks): Promise<Market[]> => {
  const query = buildEnvioMarketsPageQuery({
    useChainIdFilter: network !== undefined,
  });
  const allRows: MonarchMarketRow[] = [];
  let offset = 0;

  while (true) {
    const variables: Record<string, unknown> = {
      limit: MONARCH_MARKETS_PAGE_SIZE,
      offset,
      zeroAddress: MONARCH_MARKETS_ZERO_ADDRESS,
    };

    if (network !== undefined) {
      variables.chainId = network;
    }

    const rows = await fetchMonarchMarketsPage(query, variables);
    allRows.push(...rows);

    if (rows.length < MONARCH_MARKETS_PAGE_SIZE) {
      break;
    }

    offset += rows.length;
  }

  return mapMonarchMarketRows(allRows);
};

export const fetchMonarchMarket = async (uniqueKey: string, network: SupportedNetworks): Promise<Market | null> => {
  const rows = await fetchMonarchMarketsPage(envioMarketByIdQuery, {
    chainId: network,
    marketId: normalizeAddress(uniqueKey),
    zeroAddress: MONARCH_MARKETS_ZERO_ADDRESS,
  });

  const [market] = await mapMonarchMarketRows(rows);
  return market ?? null;
};
