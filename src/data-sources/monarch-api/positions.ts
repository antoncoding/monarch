import { envioUserPositionForMarketQuery, envioUserPositionsPageQuery } from '@/graphql/envio-queries';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import { monarchGraphqlFetcher } from './fetchers';

type PositionMarket = {
  marketUniqueKey: string;
  chainId: number;
};

type MonarchUserPositionRow = {
  marketId: string;
  chainId: number;
  supplyShares: string;
  borrowShares: string;
  collateral: string;
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

export const fetchMonarchUserPositionMarketsForNetworks = async (
  userAddress: string,
  networks: SupportedNetworks[],
): Promise<PositionMarket[]> => {
  if (networks.length === 0) {
    return [];
  }

  const requestedNetworks = new Set(networks);
  const supportedNetworks = new Set(ALL_SUPPORTED_NETWORKS);
  const positionMarkets = new Map<string, PositionMarket>();
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

      if (!isNonZero(position.supplyShares) && !isNonZero(position.borrowShares) && !isNonZero(position.collateral)) {
        continue;
      }

      const positionMarket = {
        marketUniqueKey: position.marketId,
        chainId,
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
    marketId: marketUniqueKey,
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
