import { useQuery } from '@tanstack/react-query';
import { formatUnits, type Address, type PublicClient } from 'viem';
import { erc4626Abi } from '@/abis/erc4626';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { fetchMorphoVaultV2SharePriceHistory, type MorphoVaultSharePricePoint } from '@/data-sources/morpho-api/vault-share-price-history';
import { TIMEFRAME_CONFIG, type ChartTimeframe } from '@/stores/useMarketDetailChartState';
import { fetchBlocksWithTimestamps, type BlockWithTimestamp } from '@/utils/blockEstimation';
import { supportsHistoricalStateRead, type SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import type { TimeseriesOptions } from '@/utils/types';

const PARALLEL_BATCH_SIZE = 6;
const HOUR_IN_SECONDS = 60 * 60;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

const SHARE_PRICE_API_INTERVAL_BY_TIMEFRAME: Record<ChartTimeframe, TimeseriesOptions['interval']> = {
  '1d': 'HOUR',
  '7d': 'DAY',
  '30d': 'DAY',
  '3m': 'DAY',
  '6m': 'DAY',
};

const SHARE_PRICE_POINT_INTERVAL_SECONDS: Record<ChartTimeframe, number> = {
  '1d': 2 * HOUR_IN_SECONDS,
  '7d': DAY_IN_SECONDS,
  '30d': DAY_IN_SECONDS,
  '3m': 3 * DAY_IN_SECONDS,
  '6m': 6 * DAY_IN_SECONDS,
};

export type VaultSharePricePoint = {
  blockNumber?: number;
  sharePrice: number;
  source: 'morpho-api' | 'rpc';
  timestamp: number;
  targetTimestamp: number;
};

type VaultSharePriceHistory = {
  points: VaultSharePricePoint[];
  isUnsupportedNetwork: boolean;
  source: 'morpho-api' | 'none' | 'rpc';
};

export function selectNearestVaultSharePricePoint(points: VaultSharePricePoint[], targetTimestamp: number) {
  let nearestPoint: VaultSharePricePoint | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const distance = Math.abs(point.timestamp - targetTimestamp);
    if (distance >= nearestDistance) continue;

    nearestPoint = point;
    nearestDistance = distance;
  }

  return nearestPoint;
}

function getMorphoSharePriceOptions(timeframe: ChartTimeframe, timeRange: TimeseriesOptions): TimeseriesOptions {
  return {
    ...timeRange,
    interval: SHARE_PRICE_API_INTERVAL_BY_TIMEFRAME[timeframe],
  };
}

function calculateSharePriceTimePoints(timeframe: ChartTimeframe, endTimestamp: number): number[] {
  const config = TIMEFRAME_CONFIG[timeframe];
  const startTimestamp = endTimestamp - config.durationSeconds;
  const intervalSeconds = SHARE_PRICE_POINT_INTERVAL_SECONDS[timeframe];
  const points: number[] = [];

  for (let timestamp = startTimestamp; timestamp < endTimestamp; timestamp += intervalSeconds) {
    points.push(timestamp);
  }

  points.push(endTimestamp);
  return points;
}

function selectNearestMorphoPoints(points: MorphoVaultSharePricePoint[], targetTimestamps: number[]): VaultSharePricePoint[] {
  const selected: VaultSharePricePoint[] = [];

  for (const targetTimestamp of targetTimestamps) {
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [index, point] of points.entries()) {
      const distance = Math.abs(point.timestamp - targetTimestamp);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    if (nearestIndex === -1) continue;

    const point = points[nearestIndex];
    if (!point) continue;

    selected.push({
      sharePrice: point.sharePrice,
      source: 'morpho-api',
      timestamp: point.timestamp,
      targetTimestamp,
    });
  }

  return selected.sort((left, right) => left.targetTimestamp - right.targetTimestamp);
}

async function fetchSharePricePoint(
  client: PublicClient,
  vaultAddress: Address,
  oneShareUnit: bigint,
  assetDecimals: number,
  block: BlockWithTimestamp,
): Promise<VaultSharePricePoint | null> {
  try {
    const rawSharePrice = await client.readContract({
      address: vaultAddress,
      abi: erc4626Abi,
      functionName: 'previewRedeem',
      args: [oneShareUnit],
      blockNumber: BigInt(block.blockNumber),
    });
    const sharePrice = Number(formatUnits(rawSharePrice, assetDecimals));

    if (!Number.isFinite(sharePrice)) {
      return null;
    }

    return {
      blockNumber: block.blockNumber,
      sharePrice,
      source: 'rpc',
      timestamp: block.timestamp,
      targetTimestamp: block.targetTimestamp,
    };
  } catch {
    return null;
  }
}

export function useVaultSharePriceHistory({
  assetDecimals,
  vaultAddress,
  chainId,
  timeframe,
  timeRange,
}: {
  assetDecimals?: number;
  vaultAddress?: Address;
  chainId?: SupportedNetworks;
  timeframe: ChartTimeframe;
  timeRange: TimeseriesOptions;
}) {
  const { customRpcUrls } = useCustomRpcContext();
  const customRpcUrl = chainId ? customRpcUrls[chainId] : undefined;

  return useQuery<VaultSharePriceHistory | null>({
    queryKey: [
      'vault-share-price-history',
      vaultAddress?.toLowerCase() ?? null,
      chainId ?? null,
      timeframe,
      timeRange.startTimestamp,
      timeRange.endTimestamp,
      timeRange.interval,
      assetDecimals ?? null,
      customRpcUrl ?? null,
    ],
    queryFn: async () => {
      if (!vaultAddress || !chainId) {
        return null;
      }

      const morphoTimeRange = getMorphoSharePriceOptions(timeframe, timeRange);
      const targetTimestamps = calculateSharePriceTimePoints(timeframe, timeRange.endTimestamp);
      const morphoPoints = await fetchMorphoVaultV2SharePriceHistory({
        vaultAddress,
        chainId,
        options: morphoTimeRange,
      });

      if (morphoPoints && morphoPoints.length >= 2) {
        const selectedMorphoPoints = selectNearestMorphoPoints(morphoPoints, targetTimestamps);
        const fallbackMorphoPoints = morphoPoints.map((point) => ({
          sharePrice: point.sharePrice,
          source: 'morpho-api' as const,
          timestamp: point.timestamp,
          targetTimestamp: point.timestamp,
        }));

        return {
          points: selectedMorphoPoints.length >= 2 ? selectedMorphoPoints : fallbackMorphoPoints,
          isUnsupportedNetwork: false,
          source: 'morpho-api',
        };
      }

      if (!supportsHistoricalStateRead(chainId)) {
        return {
          points: [],
          isUnsupportedNetwork: true,
          source: 'none',
        };
      }

      if (assetDecimals === undefined) {
        return null;
      }

      const client = getClient(chainId, customRpcUrl);
      const [currentBlock, shareDecimals] = await Promise.all([
        client.getBlockNumber(),
        client.readContract({
          address: vaultAddress,
          abi: erc4626Abi,
          functionName: 'decimals',
          args: [],
        }),
      ]);
      const currentBlockData = await client.getBlock({ blockNumber: currentBlock });
      const currentTimestamp = Number(currentBlockData.timestamp);
      const fallbackTargetTimestamps = calculateSharePriceTimePoints(timeframe, Math.min(timeRange.endTimestamp, currentTimestamp));
      const blocksWithTimestamps = await fetchBlocksWithTimestamps(
        client,
        chainId,
        fallbackTargetTimestamps,
        Number(currentBlock),
        currentTimestamp,
      );
      const oneShareUnit = 10n ** BigInt(shareDecimals);
      const points: VaultSharePricePoint[] = [];

      for (let i = 0; i < blocksWithTimestamps.length; i += PARALLEL_BATCH_SIZE) {
        const batch = blocksWithTimestamps.slice(i, i + PARALLEL_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((block) => fetchSharePricePoint(client, vaultAddress, oneShareUnit, assetDecimals, block)),
        );
        points.push(...batchResults.filter((point): point is VaultSharePricePoint => point !== null));
      }

      points.sort((a, b) => a.targetTimestamp - b.targetTimestamp);

      return {
        points,
        isUnsupportedNetwork: false,
        source: 'rpc',
      };
    },
    enabled: Boolean(vaultAddress && chainId && timeframe && timeRange),
    placeholderData: (previousData) => previousData ?? null,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
