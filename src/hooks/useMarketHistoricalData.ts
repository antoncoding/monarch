import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchMarketHistoricalData } from '@/data-sources/monarch-api/historical';
import { fetchMorphoMarketHistoricalData, type HistoricalDataSuccessResult } from '@/data-sources/morpho-api/historical';
import { fetchSubgraphMarketHistoricalData } from '@/data-sources/subgraph/historical';
import { fetchHistoricalMarketBoundaryStates, type HistoricalMarketBoundaryState } from '@/utils/market-rate-enrichment';
import { TIMEFRAME_CONFIG, calculateTimePoints, type ChartTimeframe } from '@/stores/useMarketDetailChartState';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market, TimeseriesOptions } from '@/utils/types';

type UseMarketHistoricalDataResult = {
  historicalData: HistoricalDataSuccessResult | null;
  stateReadPoints: HistoricalMarketBoundaryState[];
};

type HistoricalSamplePoint = {
  x: number;
  supplyApy: number;
  borrowApy: number;
  apyAtTarget: number;
  utilization: number;
  supplyAssets: bigint;
  borrowAssets: bigint;
  liquidityAssets: bigint;
};

const buildHistoricalSamplePoints = (historicalData: HistoricalDataSuccessResult | null): HistoricalSamplePoint[] => {
  if (!historicalData) {
    return [];
  }

  return historicalData.rates.supplyApy
    .map((supplyPoint, index) => {
      const borrowPoint = historicalData.rates.borrowApy[index];
      const targetPoint = historicalData.rates.apyAtTarget[index];
      const utilizationPoint = historicalData.rates.utilization[index];
      const supplyAssetsPoint = historicalData.volumes.supplyAssets[index];
      const borrowAssetsPoint = historicalData.volumes.borrowAssets[index];
      const liquidityAssetsPoint = historicalData.volumes.liquidityAssets[index];

      if (
        supplyPoint?.y == null ||
        borrowPoint?.y == null ||
        targetPoint?.y == null ||
        utilizationPoint?.y == null ||
        supplyAssetsPoint?.y == null ||
        borrowAssetsPoint?.y == null ||
        liquidityAssetsPoint?.y == null
      ) {
        return null;
      }

      return {
        x: supplyPoint.x,
        supplyApy: supplyPoint.y,
        borrowApy: borrowPoint.y,
        apyAtTarget: targetPoint.y,
        utilization: utilizationPoint.y,
        supplyAssets: supplyAssetsPoint.y,
        borrowAssets: borrowAssetsPoint.y,
        liquidityAssets: liquidityAssetsPoint.y,
      };
    })
    .filter((point): point is HistoricalSamplePoint => point !== null);
};

const buildHistoricalDataFromSamplePoints = (points: HistoricalSamplePoint[]): HistoricalDataSuccessResult => ({
  rates: {
    supplyApy: points.map((point) => ({ x: point.x, y: point.supplyApy })),
    borrowApy: points.map((point) => ({ x: point.x, y: point.borrowApy })),
    apyAtTarget: points.map((point) => ({ x: point.x, y: point.apyAtTarget })),
    utilization: points.map((point) => ({ x: point.x, y: point.utilization })),
  },
  volumes: {
    supplyAssetsUsd: [],
    borrowAssetsUsd: [],
    liquidityAssetsUsd: [],
    supplyAssets: points.map((point) => ({ x: point.x, y: point.supplyAssets })),
    borrowAssets: points.map((point) => ({ x: point.x, y: point.borrowAssets })),
    liquidityAssets: points.map((point) => ({ x: point.x, y: point.liquidityAssets })),
  },
});

const findNearestHistoricalPoint = (
  points: HistoricalSamplePoint[],
  targetTimestamp: number,
  toleranceSeconds: number,
  usedIndexes: Set<number>,
): HistoricalSamplePoint | null => {
  let bestPoint: HistoricalSamplePoint | null = null;
  let bestPointIndex = -1;
  let bestDiff = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    if (usedIndexes.has(index)) {
      return;
    }

    const diff = Math.abs(point.x - targetTimestamp);
    if (diff > toleranceSeconds || diff >= bestDiff) {
      return;
    }

    bestPoint = point;
    bestPointIndex = index;
    bestDiff = diff;
  });

  if (bestPointIndex >= 0) {
    usedIndexes.add(bestPointIndex);
  }

  return bestPoint;
};

export const useMarketHistoricalData = (
  uniqueKey: string | undefined,
  network: SupportedNetworks | undefined,
  options: TimeseriesOptions | undefined,
  market?: Market,
  timeframe?: ChartTimeframe,
) => {
  const { customRpcUrls } = useCustomRpcContext();
  const customRpcUrl = network ? customRpcUrls[network] : undefined;
  const queryKey = [
    'marketHistoricalData',
    uniqueKey,
    network,
    options?.startTimestamp,
    options?.endTimestamp,
    options?.interval,
    customRpcUrl ?? null,
    timeframe ?? null,
  ];

  const { data, isLoading, isFetching, error, refetch } = useQuery<UseMarketHistoricalDataResult>({
    queryKey: queryKey,
    queryFn: async (): Promise<UseMarketHistoricalDataResult> => {
      if (!uniqueKey || !network || !options) {
        console.log('Historical data prerequisites not met.', {
          uniqueKey,
          network,
          options,
        });
        return {
          historicalData: null,
          stateReadPoints: [],
        };
      }

      let historicalData: HistoricalDataSuccessResult | null = null;

      try {
        console.log(`Attempting to fetch historical data via Monarch API for ${uniqueKey}`);
        historicalData = await fetchMonarchMarketHistoricalData(uniqueKey, network, options);
      } catch (monarchError) {
        console.error('Failed to fetch historical data via Monarch API:', monarchError);
      }

      // Try Morpho API next if supported
      if (!historicalData && supportsMorphoApi(network)) {
        try {
          console.log(`Attempting to fetch historical data via Morpho API for ${uniqueKey}`);
          historicalData = await fetchMorphoMarketHistoricalData(uniqueKey, network, options);
        } catch (morphoError) {
          console.error('Failed to fetch historical data via Morpho API:', morphoError);
          // Continue to Subgraph fallback
        }
      }

      // If Morpho API failed or not supported, try Subgraph
      if (!historicalData) {
        try {
          console.log(`Attempting to fetch historical data via Subgraph for ${uniqueKey}`);
          historicalData = await fetchSubgraphMarketHistoricalData(uniqueKey, network, options);
        } catch (subgraphError) {
          console.error('Failed to fetch historical data via Subgraph:', subgraphError);
          historicalData = null;
        }
      }

      let stateReadPoints: HistoricalMarketBoundaryState[] = [];
      if (market && timeframe) {
        const targetTimestamps = calculateTimePoints(timeframe, options.endTimestamp).slice(0, -1);
        const toleranceSeconds = Math.max(1, Math.floor(TIMEFRAME_CONFIG[timeframe].intervalSeconds / 2));
        const historicalPoints = buildHistoricalSamplePoints(historicalData);
        const usedPointIndexes = new Set<number>();
        const pointsByTarget = new Map<number, HistoricalSamplePoint>();

        targetTimestamps.forEach((targetTimestamp) => {
          const nearestPoint = findNearestHistoricalPoint(historicalPoints, targetTimestamp, toleranceSeconds, usedPointIndexes);
          if (!nearestPoint) {
            return;
          }

          pointsByTarget.set(targetTimestamp, {
            ...nearestPoint,
            x: targetTimestamp,
          });
        });

        const missingTargetTimestamps = targetTimestamps.filter((targetTimestamp) => !pointsByTarget.has(targetTimestamp));
        try {
          stateReadPoints = await fetchHistoricalMarketBoundaryStates(
            market,
            missingTargetTimestamps,
            customRpcUrl ? { [network]: customRpcUrl } : {},
          );
        } catch (boundaryError) {
          console.error('Failed to fetch historical boundary states via RPC:', boundaryError);
          stateReadPoints = [];
        }

        stateReadPoints.forEach((point) => {
          pointsByTarget.set(point.targetTimestamp, {
            x: point.targetTimestamp,
            supplyApy: point.supplyApy,
            borrowApy: point.borrowApy,
            apyAtTarget: point.apyAtTarget,
            utilization: point.utilization,
            supplyAssets: point.supplyAssets,
            borrowAssets: point.borrowAssets,
            liquidityAssets: point.liquidityAssets,
          });
        });

        const filledPoints = targetTimestamps
          .map((targetTimestamp) => pointsByTarget.get(targetTimestamp) ?? null)
          .filter((point): point is HistoricalSamplePoint => point !== null);

        historicalData = filledPoints.length > 0 ? buildHistoricalDataFromSamplePoints(filledPoints) : null;
      }

      return {
        historicalData,
        stateReadPoints,
      };
    },
    enabled: !!uniqueKey && !!network && !!options,
    staleTime: 1000 * 60 * 5,
    placeholderData: {
      historicalData: null,
      stateReadPoints: [],
    },
    retry: 1,
  });

  return {
    data: data?.historicalData ?? null,
    stateReadPoints: data?.stateReadPoints ?? [],
    isLoading: isLoading,
    isFetching: isFetching,
    error: error,
    refetch: refetch,
  };
};
