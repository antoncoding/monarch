import { supportsMorphoApi } from '@/config/dataSources';
import { vaultV2SharePriceHistoryQuery } from '@/graphql/vault-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

export type MorphoVaultSharePricePoint = {
  timestamp: number;
  sharePrice: number;
};

type RawSharePricePoint = {
  x: unknown;
  y: unknown;
};

type VaultV2SharePriceHistoryResponse = {
  data?: {
    vaultV2ByAddress?: {
      historicalState?: {
        sharePrice?: RawSharePricePoint[] | null;
      } | null;
    } | null;
  };
  errors?: { message: string }[];
};

const sortByTimestamp = (left: MorphoVaultSharePricePoint, right: MorphoVaultSharePricePoint): number => left.timestamp - right.timestamp;

function normalizeSharePrice(value: unknown): number | null {
  const numericValue = typeof value === 'string' ? Number(value) : value;

  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

export async function fetchMorphoVaultV2SharePriceHistory({
  vaultAddress,
  chainId,
  options,
}: {
  vaultAddress: string;
  chainId: SupportedNetworks;
  options: TimeseriesOptions;
}): Promise<MorphoVaultSharePricePoint[] | null> {
  if (!supportsMorphoApi(chainId)) {
    return null;
  }

  try {
    const response = await morphoGraphqlFetcher<VaultV2SharePriceHistoryResponse>(
      vaultV2SharePriceHistoryQuery,
      {
        address: vaultAddress,
        chainId,
        options,
      },
      { timeoutMs: 8000 },
    );

    const points = response?.data?.vaultV2ByAddress?.historicalState?.sharePrice;
    if (!points || points.length === 0) {
      return null;
    }

    const normalizedPoints = points
      .map((point) => {
        const timestamp = Number(point.x);
        const sharePrice = normalizeSharePrice(point.y);
        if (!Number.isFinite(timestamp) || sharePrice === null) {
          return null;
        }

        return {
          timestamp,
          sharePrice,
        };
      })
      .filter((point): point is MorphoVaultSharePricePoint => point !== null)
      .sort(sortByTimestamp);

    return normalizedPoints.length > 0 ? normalizedPoints : null;
  } catch (error) {
    console.warn('[vaultSharePriceHistory] Morpho API share price history unavailable:', error);
    return null;
  }
}
