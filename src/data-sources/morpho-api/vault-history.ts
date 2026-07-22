import { supportsMorphoApi } from '@/config/dataSources';
import { vaultV2HistoryQuery } from '@/graphql/vault-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

export type MorphoVaultHistoryPoint = {
  timestamp: number;
  value: number;
};

export type MorphoVaultHistory = {
  nativeApy: MorphoVaultHistoryPoint[];
  sharePrice: MorphoVaultHistoryPoint[];
  totalAssets: MorphoVaultHistoryPoint[];
};

type RawHistoryPoint = {
  x: unknown;
  y: unknown;
};

type VaultV2HistoryResponse = {
  data?: {
    vaultV2ByAddress?: {
      historicalState?: {
        avgApy?: RawHistoryPoint[] | null;
        sharePrice?: RawHistoryPoint[] | null;
        totalAssets?: RawHistoryPoint[] | null;
      } | null;
    } | null;
  };
};

function normalizePoints(points: RawHistoryPoint[] | null | undefined): MorphoVaultHistoryPoint[] {
  return (points ?? [])
    .map((point) => {
      if (point.x === null || point.x === undefined || point.y === null || point.y === undefined) {
        return null;
      }

      const timestamp = Number(point.x);
      const value = Number(point.y);

      if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
        return null;
      }

      return { timestamp, value };
    })
    .filter((point): point is MorphoVaultHistoryPoint => point !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
}

export async function fetchMorphoVaultV2History({
  vaultAddress,
  chainId,
  options,
}: {
  vaultAddress: string;
  chainId: SupportedNetworks;
  options: TimeseriesOptions;
}): Promise<MorphoVaultHistory | null> {
  if (!supportsMorphoApi(chainId)) {
    return null;
  }

  try {
    const response = await morphoGraphqlFetcher<VaultV2HistoryResponse>(
      vaultV2HistoryQuery,
      { address: vaultAddress, chainId, options },
      { timeoutMs: 8000 },
    );
    const history = response?.data?.vaultV2ByAddress?.historicalState;

    if (!history) {
      return null;
    }

    return {
      nativeApy: normalizePoints(history.avgApy),
      sharePrice: normalizePoints(history.sharePrice),
      totalAssets: normalizePoints(history.totalAssets),
    };
  } catch (error) {
    console.warn('[vaultHistory] Morpho API vault history unavailable:', error);
    return null;
  }
}
