import {
  envioBorrowEventsQuery,
  envioLatestBorrowRateUpdateBeforeQuery,
  envioBorrowRateUpdatesQuery,
  envioLiquidationsQuery,
  envioRepayEventsQuery,
  envioSupplyCollateralEventsQuery,
  envioSupplyEventsQuery,
  envioWithdrawCollateralEventsQuery,
  envioWithdrawEventsQuery,
} from '@/graphql/envio-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { envioGraphqlFetcher } from './fetchers';
import { fetchAllEnvioPages } from './utils';

const ENVIO_EVENTS_PAGE_SIZE = 500;
const ENVIO_EVENTS_MAX_ITEMS = Number.MAX_SAFE_INTEGER;
const ENVIO_EVENTS_TIMEOUT_MS = 15_000;

export type EnvioLoanEventRow = {
  assets: string | number;
  chainId: number;
  market_id: string;
  onBehalf: string;
  shares?: string | number;
  timestamp: string | number;
  txHash: string;
};

export type EnvioWithdrawEventRow = EnvioLoanEventRow & {
  receiver?: string;
};

export type EnvioLiquidationEventRow = {
  badDebtAssets: string | number;
  borrower: string;
  caller: string;
  chainId: number;
  market_id: string;
  repaidAssets: string | number;
  repaidShares?: string | number;
  seizedAssets: string | number;
  timestamp: string | number;
  txHash: string;
};

export type EnvioBorrowRateUpdateRow = {
  avgBorrowRate: string | number;
  chainId: number;
  market_id: string;
  rateAtTarget: string | number;
  timestamp: string | number;
  txHash: string;
};

type EnvioLoanEventsResponse = {
  data?: {
    Morpho_Borrow?: EnvioLoanEventRow[];
    Morpho_Repay?: EnvioLoanEventRow[];
    Morpho_Supply?: EnvioLoanEventRow[];
    Morpho_SupplyCollateral?: EnvioLoanEventRow[];
    Morpho_Withdraw?: EnvioWithdrawEventRow[];
    Morpho_WithdrawCollateral?: EnvioWithdrawEventRow[];
  };
};

type EnvioLiquidationsResponse = {
  data?: {
    Morpho_Liquidate?: EnvioLiquidationEventRow[];
  };
};

type EnvioBorrowRateUpdatesResponse = {
  data?: {
    AdaptiveCurveIrm_BorrowRateUpdate?: EnvioBorrowRateUpdateRow[];
  };
};

const fetchEnvioLoanEvents = async <T extends keyof NonNullable<EnvioLoanEventsResponse['data']>>({
  field,
  limit,
  offset,
  query,
  where,
}: {
  field: T;
  limit: number;
  offset: number;
  query: string;
  where: Record<string, unknown>;
}): Promise<NonNullable<NonNullable<EnvioLoanEventsResponse['data']>[T]>> => {
  const response = await envioGraphqlFetcher<EnvioLoanEventsResponse>(
    query,
    {
      limit,
      offset,
      where,
    },
    {
      timeoutMs: ENVIO_EVENTS_TIMEOUT_MS,
    },
  );

  return (response.data?.[field] ?? []) as NonNullable<NonNullable<EnvioLoanEventsResponse['data']>[T]>;
};

const fetchEnvioLiquidationEventsPage = async (limit: number, offset: number, where: Record<string, unknown>) => {
  const response = await envioGraphqlFetcher<EnvioLiquidationsResponse>(
    envioLiquidationsQuery,
    {
      limit,
      offset,
      where,
    },
    {
      timeoutMs: ENVIO_EVENTS_TIMEOUT_MS,
    },
  );

  return response.data?.Morpho_Liquidate ?? [];
};

const fetchEnvioBorrowRateUpdatesPage = async (limit: number, offset: number, where: Record<string, unknown>) => {
  const response = await envioGraphqlFetcher<EnvioBorrowRateUpdatesResponse>(
    envioBorrowRateUpdatesQuery,
    {
      limit,
      offset,
      where,
    },
    {
      timeoutMs: ENVIO_EVENTS_TIMEOUT_MS,
    },
  );

  return response.data?.AdaptiveCurveIrm_BorrowRateUpdate ?? [];
};

export const fetchEnvioSupplyRows = async (where: Record<string, unknown>): Promise<EnvioLoanEventRow[]> => {
  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) =>
      fetchEnvioLoanEvents({
        field: 'Morpho_Supply',
        limit,
        offset,
        query: envioSupplyEventsQuery,
        where,
      }),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchEnvioWithdrawRows = async (where: Record<string, unknown>): Promise<EnvioWithdrawEventRow[]> => {
  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) =>
      fetchEnvioLoanEvents({
        field: 'Morpho_Withdraw',
        limit,
        offset,
        query: envioWithdrawEventsQuery,
        where,
      }),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchEnvioBorrowRows = async (where: Record<string, unknown>): Promise<EnvioLoanEventRow[]> => {
  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) =>
      fetchEnvioLoanEvents({
        field: 'Morpho_Borrow',
        limit,
        offset,
        query: envioBorrowEventsQuery,
        where,
      }),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchEnvioRepayRows = async (where: Record<string, unknown>): Promise<EnvioLoanEventRow[]> => {
  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) =>
      fetchEnvioLoanEvents({
        field: 'Morpho_Repay',
        limit,
        offset,
        query: envioRepayEventsQuery,
        where,
      }),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchEnvioSupplyCollateralRows = async (where: Record<string, unknown>): Promise<EnvioLoanEventRow[]> => {
  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) =>
      fetchEnvioLoanEvents({
        field: 'Morpho_SupplyCollateral',
        limit,
        offset,
        query: envioSupplyCollateralEventsQuery,
        where,
      }),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchEnvioWithdrawCollateralRows = async (where: Record<string, unknown>): Promise<EnvioWithdrawEventRow[]> => {
  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) =>
      fetchEnvioLoanEvents({
        field: 'Morpho_WithdrawCollateral',
        limit,
        offset,
        query: envioWithdrawCollateralEventsQuery,
        where,
      }),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchEnvioLiquidationRows = async (where: Record<string, unknown>): Promise<EnvioLiquidationEventRow[]> => {
  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) => fetchEnvioLiquidationEventsPage(limit, offset, where),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchEnvioBorrowRateUpdates = async ({
  chainId,
  marketId,
  timestampGte,
  timestampLte,
}: {
  chainId: SupportedNetworks;
  marketId: string;
  timestampGte?: number;
  timestampLte?: number;
}): Promise<EnvioBorrowRateUpdateRow[]> => {
  const where: Record<string, unknown> = {
    chainId: {
      _eq: chainId,
    },
    market_id: {
      _eq: marketId.toLowerCase(),
    },
  };

  if (timestampGte != null || timestampLte != null) {
    where.timestamp = {
      ...(timestampGte != null ? { _gte: timestampGte } : {}),
      ...(timestampLte != null ? { _lte: timestampLte } : {}),
    };
  }

  return fetchAllEnvioPages({
    fetchPage: async (limit, offset) => fetchEnvioBorrowRateUpdatesPage(limit, offset, where),
    maxItems: ENVIO_EVENTS_MAX_ITEMS,
    pageSize: ENVIO_EVENTS_PAGE_SIZE,
  });
};

export const fetchLatestEnvioBorrowRateUpdateBefore = async ({
  chainId,
  marketId,
  timestampLte,
}: {
  chainId: SupportedNetworks;
  marketId: string;
  timestampLte: number;
}): Promise<EnvioBorrowRateUpdateRow | null> => {
  const response = await envioGraphqlFetcher<EnvioBorrowRateUpdatesResponse>(
    envioLatestBorrowRateUpdateBeforeQuery,
    {
      chainId,
      marketId: marketId.toLowerCase(),
      timestampLte,
    },
    {
      timeoutMs: ENVIO_EVENTS_TIMEOUT_MS,
    },
  );

  return response.data?.AdaptiveCurveIrm_BorrowRateUpdate?.[0] ?? null;
};
