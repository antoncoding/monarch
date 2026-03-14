import {
  envioMarketBorrowersCountQuery,
  envioMarketBorrowersQuery,
  envioMarketSuppliersCountQuery,
  envioMarketSuppliersQuery,
} from '@/graphql/envio-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketBorrower, MarketSupplier, PaginatedMarketBorrowers, PaginatedMarketSuppliers } from '@/utils/types';
import { fetchEnvioMarket } from './market';
import { envioGraphqlFetcher } from './fetchers';
import { normalizeEnvioString } from './utils';

const ENVIO_PARTICIPANTS_TIMEOUT_MS = 15_000;

type EnvioSupplierRow = {
  marketId: string;
  supplyShares: string | number;
  user: string;
};

type EnvioBorrowerRow = {
  borrowShares: string | number;
  collateral: string | number;
  marketId: string;
  user: string;
};

type EnvioParticipantsResponse = {
  data?: {
    Position?: (EnvioSupplierRow | EnvioBorrowerRow)[];
  };
};

type EnvioParticipantsCountResponse = {
  data?: {
    Position_aggregate?: {
      aggregate?: {
        count?: number | null;
      } | null;
    } | null;
  };
};

const toAssets = (shares: string, totalAssets: string, totalShares: string): string => {
  try {
    const parsedShares = BigInt(shares);
    const parsedTotalAssets = BigInt(totalAssets);
    const parsedTotalShares = BigInt(totalShares);

    if (parsedShares <= 0n || parsedTotalAssets <= 0n || parsedTotalShares <= 0n) {
      return '0';
    }

    return ((parsedShares * parsedTotalAssets) / parsedTotalShares).toString();
  } catch {
    return '0';
  }
};

const fetchPositionRows = async <TRow extends EnvioSupplierRow | EnvioBorrowerRow>({
  limit,
  offset,
  query,
  where,
}: {
  limit: number;
  offset: number;
  query: string;
  where: Record<string, unknown>;
}): Promise<TRow[]> => {
  const response = await envioGraphqlFetcher<EnvioParticipantsResponse>(
    query,
    {
      limit,
      offset,
      where,
    },
    {
      timeoutMs: ENVIO_PARTICIPANTS_TIMEOUT_MS,
    },
  );

  return (response.data?.Position ?? []) as TRow[];
};

const fetchPositionCount = async ({
  query,
  where,
}: {
  query: string;
  where: Record<string, unknown>;
}): Promise<number> => {
  const response = await envioGraphqlFetcher<EnvioParticipantsCountResponse>(
    query,
    {
      where,
    },
    {
      timeoutMs: ENVIO_PARTICIPANTS_TIMEOUT_MS,
    },
  );

  return response.data?.Position_aggregate?.aggregate?.count ?? 0;
};

export const fetchEnvioMarketSuppliers = async (
  marketId: string,
  chainId: SupportedNetworks,
  minShares = '0',
  pageSize = 8,
  skip = 0,
): Promise<PaginatedMarketSuppliers> => {
  const where = {
    chainId: {
      _eq: chainId,
    },
    marketId: {
      _eq: marketId.toLowerCase(),
    },
    supplyShares: {
      _gte: minShares,
    },
  };

  const [suppliers, totalCount] = await Promise.all([
    fetchPositionRows<EnvioSupplierRow>({
      limit: pageSize,
      offset: skip,
      query: envioMarketSuppliersQuery,
      where,
    }),
    fetchPositionCount({
      query: envioMarketSuppliersCountQuery,
      where,
    }),
  ]);

  const items: MarketSupplier[] = suppliers.map((supplier) => ({
    supplyShares: normalizeEnvioString(supplier.supplyShares),
    userAddress: supplier.user,
  }));

  return {
    items,
    totalCount,
  };
};

export const fetchEnvioMarketBorrowers = async (
  marketId: string,
  chainId: SupportedNetworks,
  minShares = '0',
  pageSize = 10,
  skip = 0,
): Promise<PaginatedMarketBorrowers> => {
  const where = {
    borrowShares: {
      _gte: minShares,
    },
    chainId: {
      _eq: chainId,
    },
    marketId: {
      _eq: marketId.toLowerCase(),
    },
  };

  const [market, borrowers, totalCount] = await Promise.all([
    fetchEnvioMarket(marketId, chainId),
    fetchPositionRows<EnvioBorrowerRow>({
      limit: pageSize,
      offset: skip,
      query: envioMarketBorrowersQuery,
      where,
    }),
    fetchPositionCount({
      query: envioMarketBorrowersCountQuery,
      where,
    }),
  ]);

  if (!market) {
    throw new Error(`Failed to hydrate Envio market ${marketId} on chain ${chainId} for borrower mapping`);
  }

  const items: MarketBorrower[] = borrowers.map((borrower) => {
    const borrowShares = normalizeEnvioString(borrower.borrowShares);

    return {
      borrowAssets: toAssets(borrowShares, market.state.borrowAssets, market.state.borrowShares),
      collateral: normalizeEnvioString(borrower.collateral),
      userAddress: borrower.user,
    };
  });

  return {
    items,
    totalCount,
  };
};
