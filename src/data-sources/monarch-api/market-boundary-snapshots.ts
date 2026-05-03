import { envioMarketBoundarySnapshotQuery } from '@/graphql/envio-queries';
import type { SupportedNetworks } from '@/utils/networks';
import { monarchGraphqlFetcher } from './fetchers';

export type MonarchMarketBoundarySnapshot = {
  timestamp: number;
  blockNumber: number;
  totalSupplyAssets: string;
  totalSupplyShares: string;
  totalBorrowAssets: string;
  totalBorrowShares: string;
};

type MonarchMarketBoundarySnapshotRow = {
  timestamp: string | number;
  blockNumber: string | number;
  totalSupplyAssets: string;
  totalSupplyShares: string;
  totalBorrowAssets: string;
  totalBorrowShares: string;
};

type MonarchMarketBoundarySnapshotResponse = {
  data?: {
    hourly?: MonarchMarketBoundarySnapshotRow[];
    daily?: MonarchMarketBoundarySnapshotRow[];
  };
};

const normalizeSnapshot = (row: MonarchMarketBoundarySnapshotRow | undefined): MonarchMarketBoundarySnapshot | null => {
  if (!row) return null;

  const timestamp = Number(row.timestamp);
  const blockNumber = Number(row.blockNumber);
  if (!Number.isFinite(timestamp) || !Number.isFinite(blockNumber)) {
    return null;
  }

  return {
    timestamp,
    blockNumber,
    totalSupplyAssets: row.totalSupplyAssets,
    totalSupplyShares: row.totalSupplyShares,
    totalBorrowAssets: row.totalBorrowAssets,
    totalBorrowShares: row.totalBorrowShares,
  };
};

export const fetchMonarchMarketBoundarySnapshot = async (
  marketId: string,
  chainId: SupportedNetworks,
  timestamp: number,
): Promise<MonarchMarketBoundarySnapshot | null> => {
  const response = await monarchGraphqlFetcher<MonarchMarketBoundarySnapshotResponse>(envioMarketBoundarySnapshotQuery, {
    chainId,
    marketId: marketId.toLowerCase(),
    timestamp: String(timestamp),
  });

  return normalizeSnapshot(response.data?.hourly?.[0]) ?? normalizeSnapshot(response.data?.daily?.[0]);
};

export const fetchMonarchMarketBoundarySnapshots = async (
  marketIds: string[],
  chainId: SupportedNetworks,
  timestamp: number,
): Promise<Map<string, MonarchMarketBoundarySnapshot>> => {
  const uniqueMarketIds = Array.from(new Set(marketIds.map((marketId) => marketId.toLowerCase())));
  const entries = await Promise.all(
    uniqueMarketIds.map(async (marketId) => {
      const snapshot = await fetchMonarchMarketBoundarySnapshot(marketId, chainId, timestamp);
      return snapshot ? ([marketId, snapshot] as const) : null;
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, MonarchMarketBoundarySnapshot] => entry !== null));
};
