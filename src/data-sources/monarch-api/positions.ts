import { envioUserPositionForMarketQuery, envioUserPositionsPageQuery } from '@/graphql/envio-queries';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import type { SupplyPositionHistory } from '@/utils/types';
import { monarchGraphqlFetcher } from './fetchers';

type MonarchPositionMarket = {
  marketUniqueKey: string;
  chainId: number;
  hasSupplyHistory?: boolean;
  supplyHistory?: SupplyPositionHistory;
};

type MonarchUserPositionRow = {
  marketId: string;
  chainId: number;
  supplyShares: string;
  borrowShares: string;
  collateral: string;
  firstSupplyTimestamp: string | null;
  lastSupplyActivityTimestamp: string | null;
  lastSupplyActivityBlockNumber: string | null;
  lastSupplyActivityLogIndex: number | null;
  supplyAssetsPrincipal: string;
  totalSuppliedAssets: string;
  totalWithdrawnAssets: string;
  supplyWeightedAssetsSeconds: string;
  supplyActiveSeconds: string;
};

type MonarchUserPositionsPageResponse = {
  data?: {
    Position?: MonarchUserPositionRow[];
  };
};

export type MonarchUserPositionState = {
  supplyShares: string;
  borrowShares: string;
  collateral: string;
};

const MONARCH_POSITION_MARKETS_PAGE_SIZE = 500;

const isNonZero = (value: string | null | undefined): boolean => {
  return value !== null && value !== undefined && value !== '0';
};

const getSupplyHistory = (position: MonarchUserPositionRow): SupplyPositionHistory | undefined => {
  if (position.firstSupplyTimestamp === null || position.lastSupplyActivityTimestamp === null) {
    return undefined;
  }

  return {
    firstSupplyTimestamp: Number(position.firstSupplyTimestamp),
    lastSupplyActivityTimestamp: Number(position.lastSupplyActivityTimestamp),
    lastSupplyActivityBlockNumber:
      position.lastSupplyActivityBlockNumber === null ? undefined : Number(position.lastSupplyActivityBlockNumber),
    lastSupplyActivityLogIndex: position.lastSupplyActivityLogIndex ?? undefined,
    supplyAssetsPrincipal: position.supplyAssetsPrincipal,
    totalSuppliedAssets: position.totalSuppliedAssets,
    totalWithdrawnAssets: position.totalWithdrawnAssets,
    supplyWeightedAssetsSeconds: position.supplyWeightedAssetsSeconds,
    supplyActiveSeconds: Number(position.supplyActiveSeconds),
  };
};

export const fetchMonarchUserPositionMarketsForNetworks = async (
  userAddress: string,
  networks: SupportedNetworks[],
): Promise<MonarchPositionMarket[]> => {
  if (networks.length === 0) {
    return [];
  }

  const requestedNetworks = new Set(networks);
  const supportedNetworks = new Set(ALL_SUPPORTED_NETWORKS);
  const positionMarkets = new Map<string, MonarchPositionMarket>();
  let offset = 0;

  while (true) {
    const response = await monarchGraphqlFetcher<MonarchUserPositionsPageResponse>(envioUserPositionsPageQuery, {
      user: userAddress.toLowerCase(),
      chainIds: networks,
      limit: MONARCH_POSITION_MARKETS_PAGE_SIZE,
      offset,
    });

    const positions = response.data?.Position ?? [];

    for (const position of positions) {
      const chainId = position.chainId as SupportedNetworks;
      if (!supportedNetworks.has(chainId) || !requestedNetworks.has(chainId)) {
        continue;
      }

      const supplyHistory = getSupplyHistory(position);
      if (!supplyHistory && !isNonZero(position.supplyShares) && !isNonZero(position.borrowShares) && !isNonZero(position.collateral)) {
        continue;
      }

      const positionMarket = {
        marketUniqueKey: position.marketId,
        chainId,
        hasSupplyHistory: Boolean(supplyHistory),
        supplyHistory,
      };

      positionMarkets.set(`${positionMarket.marketUniqueKey.toLowerCase()}-${positionMarket.chainId}`, positionMarket);
    }

    if (positions.length < MONARCH_POSITION_MARKETS_PAGE_SIZE) {
      break;
    }

    offset += positions.length;
  }

  return Array.from(positionMarkets.values());
};

export const fetchMonarchUserPositionStateForMarket = async (
  marketUniqueKey: string,
  userAddress: string,
  network: SupportedNetworks,
): Promise<MonarchUserPositionState | null> => {
  const response = await monarchGraphqlFetcher<MonarchUserPositionsPageResponse>(envioUserPositionForMarketQuery, {
    user: userAddress.toLowerCase(),
    chainId: network,
    marketId: marketUniqueKey.toLowerCase(),
  });

  const position = response.data?.Position?.[0];

  if (!position) {
    return null;
  }

  if (!isNonZero(position.supplyShares) && !isNonZero(position.borrowShares) && !isNonZero(position.collateral)) {
    return null;
  }

  return {
    supplyShares: position.supplyShares,
    borrowShares: position.borrowShares,
    collateral: position.collateral,
  };
};
