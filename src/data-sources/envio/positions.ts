import type { MarketPosition } from '@/utils/types';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import { envioPositionForMarketQuery, envioPositionsQuery } from '@/graphql/envio-queries';
import { fetchEnvioMarket } from './market';
import { envioGraphqlFetcher } from './fetchers';

type EnvioPositionRow = {
  chainId: number;
  marketId: string;
  supplyShares: string | number;
  borrowShares: string | number;
  collateral: string | number;
  user: string;
};

type EnvioPositionsResponse = {
  data?: {
    Position?: EnvioPositionRow[];
  };
};

const ENVIO_POSITIONS_PAGE_SIZE = 1000;
const ENVIO_POSITIONS_TIMEOUT_MS = 20_000;

const normalizeString = (value: string | number | null | undefined): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return '0';
};

const toAssets = (shares: string, totalAssets: string, totalShares: string): string => {
  const sharesBigInt = BigInt(shares);
  const totalAssetsBigInt = BigInt(totalAssets);
  const totalSharesBigInt = BigInt(totalShares);

  if (sharesBigInt <= 0n || totalAssetsBigInt <= 0n || totalSharesBigInt <= 0n) {
    return '0';
  }

  return ((sharesBigInt * totalAssetsBigInt) / totalSharesBigInt).toString();
};

const buildPositionsWhere = (user: string, chainIds: SupportedNetworks[]) => {
  return {
    user: {
      _eq: user.toLowerCase(),
    },
    chainId: {
      _in: chainIds,
    },
    _or: [
      {
        supplyShares: {
          _gt: '0',
        },
      },
      {
        borrowShares: {
          _gt: '0',
        },
      },
      {
        collateral: {
          _gt: '0',
        },
      },
    ],
  };
};

const fetchEnvioPositionsPage = async (user: string, chainIds: SupportedNetworks[], offset: number): Promise<EnvioPositionRow[]> => {
  const response = await envioGraphqlFetcher<EnvioPositionsResponse>(
    envioPositionsQuery,
    {
      limit: ENVIO_POSITIONS_PAGE_SIZE,
      offset,
      where: buildPositionsWhere(user, chainIds),
    },
    {
      timeoutMs: ENVIO_POSITIONS_TIMEOUT_MS,
    },
  );

  return response.data?.Position ?? [];
};

export const fetchEnvioUserPositionMarkets = async (
  userAddress: string,
  chainIds: SupportedNetworks[] = ALL_SUPPORTED_NETWORKS,
): Promise<{ marketUniqueKey: string; chainId: number }[]> => {
  const positions: EnvioPositionRow[] = [];

  for (let offset = 0; ; offset += ENVIO_POSITIONS_PAGE_SIZE) {
    const page = await fetchEnvioPositionsPage(userAddress, chainIds, offset);
    if (page.length === 0) break;

    positions.push(...page);

    if (page.length < ENVIO_POSITIONS_PAGE_SIZE) {
      break;
    }
  }

  return positions.map((position) => ({
    marketUniqueKey: normalizeString(position.marketId),
    chainId: position.chainId,
  }));
};

export const fetchEnvioUserPositionForMarket = async (
  marketUniqueKey: string,
  userAddress: string,
  chainId: SupportedNetworks,
  options: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<MarketPosition | null> => {
  const response = await envioGraphqlFetcher<EnvioPositionsResponse>(
    envioPositionForMarketQuery,
    {
      chainId,
      marketId: marketUniqueKey.toLowerCase(),
      user: userAddress.toLowerCase(),
    },
    {
      timeoutMs: ENVIO_POSITIONS_TIMEOUT_MS,
    },
  );

  const position = response.data?.Position?.[0];

  if (!position) {
    return null;
  }

  const market = await fetchEnvioMarket(marketUniqueKey, chainId, options);

  if (!market) {
    return null;
  }

  const supplyShares = normalizeString(position.supplyShares);
  const borrowShares = normalizeString(position.borrowShares);
  const collateral = normalizeString(position.collateral);
  const supplyAssets = toAssets(supplyShares, market.state.supplyAssets, market.state.supplyShares);
  const borrowAssets = toAssets(borrowShares, market.state.borrowAssets, market.state.borrowShares);

  if (supplyAssets === '0' && borrowAssets === '0' && collateral === '0') {
    return null;
  }

  return {
    market,
    state: {
      supplyShares,
      supplyAssets,
      borrowShares,
      borrowAssets,
      collateral,
    },
  };
};
