import { formatUnits } from 'viem';
import { envioMarketDailySnapshotsQuery, envioMarketHourlySnapshotsQuery } from '@/graphql/envio-queries';
import { convertAprToApy } from '@/utils/rateMath';
import type { MarketRates, MarketVolumes, TimeseriesOptions } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import type { HistoricalDataSuccessResult } from '../morpho-api/historical';
import { monarchGraphqlFetcher } from './fetchers';

type MonarchHistoricalSnapshotRow = {
  timestamp: string;
  totalSupplyAssets: string;
  totalBorrowAssets: string;
  supplyRateApr: string;
  borrowRateApr: string;
  rateAtTargetApr: string;
  utilization: string;
};

type MonarchHistoricalSnapshotsResponse = {
  data?: {
    MarketHourlySnapshot?: MonarchHistoricalSnapshotRow[];
    MarketDailySnapshot?: MonarchHistoricalSnapshotRow[];
  };
};

const WAD_DECIMALS = 18;
const MONARCH_HISTORICAL_PAGE_LIMIT = 1_000;
const MONARCH_HISTORICAL_TIMEOUT_MS = 10_000;

const sortByTimestamp = (left: { x: number }, right: { x: number }): number => left.x - right.x;

const parseIntegerValue = (value: string): bigint | null => {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const parseWadDecimal = (value: string): number | null => {
  try {
    return Number(formatUnits(BigInt(value), WAD_DECIMALS));
  } catch {
    return null;
  }
};

const createEmptyVolumes = (): MarketVolumes => ({
  supplyAssetsUsd: [],
  borrowAssetsUsd: [],
  liquidityAssetsUsd: [],
  supplyAssets: [],
  borrowAssets: [],
  liquidityAssets: [],
});

const transformSnapshotsToHistoricalResult = (snapshots: MonarchHistoricalSnapshotRow[]): HistoricalDataSuccessResult | null => {
  if (snapshots.length === 0) {
    return null;
  }

  const rates: MarketRates = {
    supplyApy: [],
    borrowApy: [],
    apyAtTarget: [],
    utilization: [],
  };
  const volumes = createEmptyVolumes();

  for (const snapshot of snapshots) {
    const timestamp = Number.parseInt(snapshot.timestamp, 10);
    const supplyAssets = parseIntegerValue(snapshot.totalSupplyAssets);
    const borrowAssets = parseIntegerValue(snapshot.totalBorrowAssets);
    const supplyApr = parseWadDecimal(snapshot.supplyRateApr);
    const borrowApr = parseWadDecimal(snapshot.borrowRateApr);
    const targetApr = parseWadDecimal(snapshot.rateAtTargetApr);
    const utilization = parseWadDecimal(snapshot.utilization);

    if (
      !Number.isFinite(timestamp) ||
      supplyAssets === null ||
      borrowAssets === null ||
      supplyApr === null ||
      borrowApr === null ||
      targetApr === null ||
      utilization === null
    ) {
      continue;
    }

    rates.supplyApy.push({
      x: timestamp,
      y: convertAprToApy(supplyApr),
    });
    rates.borrowApy.push({
      x: timestamp,
      y: convertAprToApy(borrowApr),
    });
    rates.apyAtTarget.push({
      x: timestamp,
      y: convertAprToApy(targetApr),
    });
    rates.utilization.push({
      x: timestamp,
      y: utilization,
    });

    volumes.supplyAssets.push({
      x: timestamp,
      y: supplyAssets,
    });
    volumes.borrowAssets.push({
      x: timestamp,
      y: borrowAssets,
    });
    volumes.liquidityAssets.push({
      x: timestamp,
      y: supplyAssets - borrowAssets,
    });
  }

  if (rates.supplyApy.length === 0) {
    return null;
  }

  Object.values(rates).forEach((series) => series.sort(sortByTimestamp));
  Object.values(volumes).forEach((series) => series.sort(sortByTimestamp));

  return { rates, volumes };
};

export const fetchMonarchMarketHistoricalData = async (
  marketId: string,
  chainId: SupportedNetworks,
  options: TimeseriesOptions,
): Promise<HistoricalDataSuccessResult | null> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MONARCH_HISTORICAL_TIMEOUT_MS);

  const variables = {
    chainId,
    marketId: marketId.toLowerCase(),
    startTimestamp: String(options.startTimestamp),
    endTimestamp: String(options.endTimestamp),
    limit: MONARCH_HISTORICAL_PAGE_LIMIT,
  };

  const query =
    options.interval === 'HOUR'
      ? envioMarketHourlySnapshotsQuery
      : envioMarketDailySnapshotsQuery;

  try {
    const response = await monarchGraphqlFetcher<MonarchHistoricalSnapshotsResponse>(query, variables, {
      signal: controller.signal,
    });
    const snapshots =
      options.interval === 'HOUR'
        ? (response.data?.MarketHourlySnapshot ?? [])
        : (response.data?.MarketDailySnapshot ?? []);

    return transformSnapshotsToHistoricalResult(snapshots);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Monarch historical request timed out after ${MONARCH_HISTORICAL_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};
