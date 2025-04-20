import { marketHourlySnapshotsQuery } from '@/graphql/morpho-subgraph-queries';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { TimeseriesOptions, TimeseriesDataPoint, MarketRates, MarketVolumes } from '@/utils/types';
import { HistoricalDataSuccessResult } from '../morpho-api/historical';
import { subgraphGraphqlFetcher } from './fetchers';

// --- Subgraph Specific Types (Copied from useSubgraphMarketHistoricalData.ts) ---
type SubgraphInterestRate = {
  id: string;
  rate: string;
  side: 'LENDER' | 'BORROWER';
  type: 'VARIABLE' | 'STABLE' | 'FIXED';
};

type SubgraphMarketHourlySnapshot = {
  id: string;
  timestamp: string;
  market: {
    id: string;
  };
  rates: SubgraphInterestRate[];
  totalDepositBalanceUSD: string;
  totalBorrowBalanceUSD: string;
  inputTokenBalance: string;
  inputTokenPriceUSD: string;
  hourlyDepositUSD: string;
  hourlyBorrowUSD: string;
  outputTokenSupply: string | null;
  variableBorrowedTokenBalance: string | null;
};

type SubgraphMarketHourlySnapshotQueryResponse = {
  data: {
    marketHourlySnapshots: SubgraphMarketHourlySnapshot[];
  };
};
// --- End Subgraph Specific Types ---

// Transformation function (simplified)
const transformSubgraphSnapshotsToHistoricalResult = (
  snapshots: SubgraphMarketHourlySnapshot[], // Expect non-empty array here
): HistoricalDataSuccessResult => {
  const rates: MarketRates = {
    supplyApy: [] as TimeseriesDataPoint[],
    borrowApy: [] as TimeseriesDataPoint[],
    rateAtUTarget: [] as TimeseriesDataPoint[],
    utilization: [] as TimeseriesDataPoint[],
  };
  const volumes: MarketVolumes = {
    supplyAssetsUsd: [] as TimeseriesDataPoint[],
    borrowAssetsUsd: [] as TimeseriesDataPoint[],
    liquidityAssetsUsd: [] as TimeseriesDataPoint[],
    supplyAssets: [] as TimeseriesDataPoint[],
    borrowAssets: [] as TimeseriesDataPoint[],
    liquidityAssets: [] as TimeseriesDataPoint[],
  };

  // No need to check for !snapshots here, handled by caller
  snapshots.forEach((snapshot) => {
    const timestamp = parseInt(snapshot.timestamp, 10);
    if (isNaN(timestamp)) {
      console.warn('Skipping snapshot due to invalid timestamp:', snapshot);
      return;
    }

    const snapshotRates = Array.isArray(snapshot.rates) ? snapshot.rates : [];
    const supplyRate = snapshotRates.find((r) => r?.side === 'LENDER');
    const borrowRate = snapshotRates.find((r) => r?.side === 'BORROWER');

    const supplyApyValue = supplyRate?.rate ? parseFloat(supplyRate.rate) : 0;
    const borrowApyValue = borrowRate?.rate ? parseFloat(borrowRate.rate) : 0;

    rates.supplyApy.push({ x: timestamp, y: !isNaN(supplyApyValue) ? supplyApyValue : 0 });
    rates.borrowApy.push({ x: timestamp, y: !isNaN(borrowApyValue) ? borrowApyValue : 0 });
    rates.rateAtUTarget.push({ x: timestamp, y: 0 });
    rates.utilization.push({ x: timestamp, y: 0 });

    const supplyNative = BigInt(snapshot.inputTokenBalance ?? '0');
    const borrowNative = BigInt(snapshot.variableBorrowedTokenBalance ?? '0');
    const liquidityNative = supplyNative - borrowNative;

    volumes.supplyAssetsUsd.push({ x: timestamp, y: 0 });
    volumes.borrowAssetsUsd.push({ x: timestamp, y: 0 });
    volumes.liquidityAssetsUsd.push({ x: timestamp, y: 0 });

    volumes.supplyAssets.push({ x: timestamp, y: Number(supplyNative) });
    volumes.borrowAssets.push({ x: timestamp, y: Number(borrowNative) });
    volumes.liquidityAssets.push({ x: timestamp, y: Number(liquidityNative) });
  });

  // Sort data by timestamp
  Object.values(rates).forEach((arr: TimeseriesDataPoint[]) =>
    arr.sort((a: TimeseriesDataPoint, b: TimeseriesDataPoint) => a.x - b.x),
  );
  Object.values(volumes).forEach((arr: TimeseriesDataPoint[]) =>
    arr.sort((a: TimeseriesDataPoint, b: TimeseriesDataPoint) => a.x - b.x),
  );

  return { rates, volumes };
};

// Fetcher function for Subgraph historical data
export const fetchSubgraphMarketHistoricalData = async (
  marketId: string,
  network: SupportedNetworks,
  timeRange: TimeseriesOptions,
): Promise<HistoricalDataSuccessResult | null> => {
  // Updated return type

  if (!timeRange.startTimestamp || !timeRange.endTimestamp) {
    console.warn('Subgraph historical fetch requires start and end timestamps.');
    return null; // Return null
  }

  const subgraphApiUrl = getSubgraphUrl(network);
  if (!subgraphApiUrl) {
    console.error(`Subgraph URL for network ${network} is not defined.`);
    return null; // Return null
  }

  try {
    const variables = {
      marketId: marketId.toLowerCase(),
      startTimestamp: String(timeRange.startTimestamp),
      endTimestamp: String(timeRange.endTimestamp),
    };

    const response = await subgraphGraphqlFetcher<SubgraphMarketHourlySnapshotQueryResponse>(
      subgraphApiUrl,
      marketHourlySnapshotsQuery,
      variables,
    );

    // If no data or empty snapshots array, return null
    if (
      !response.data ||
      !response.data.marketHourlySnapshots ||
      response.data.marketHourlySnapshots.length === 0
    ) {
      console.warn(`No subgraph historical snapshots found for market ${marketId}`);
      return null;
    }

    // Pass the guaranteed non-empty array to the transformer
    return transformSubgraphSnapshotsToHistoricalResult(response.data.marketHourlySnapshots);
  } catch (error) {
    console.error('Error fetching or processing subgraph historical data:', error);
    return null; // Return null on error
  }
};
