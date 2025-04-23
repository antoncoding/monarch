import { marketHistoricalDataQuery } from '@/graphql/morpho-api-queries';
import { SupportedNetworks } from '@/utils/networks';
import {
  TimeseriesOptions,
  Market,
  TimeseriesDataPoint,
  MarketRates,
  MarketVolumes,
} from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

// --- Types related to Historical Data ---
// Re-exported from types.ts for clarity or define locally if not exported
export type { TimeseriesDataPoint, TimeseriesOptions };

// Adjust the response structure type: historicalState contains rates/volumes directly
type MarketWithHistoricalState = Market & {
  historicalState: (Partial<MarketRates> & Partial<MarketVolumes>) | null;
};

type HistoricalDataGraphQLResponse = {
  data: {
    marketByUniqueKey: MarketWithHistoricalState;
  };
  errors?: { message: string }[];
};

// Standardized result type for historical data hooks
// Represents the successful return structure, undefined indicates not found/error
export type HistoricalDataSuccessResult = {
  rates: MarketRates;
  volumes: MarketVolumes;
};
// --- End Types ---

// Fetcher for historical market data from Morpho API
export const fetchMorphoMarketHistoricalData = async (
  uniqueKey: string,
  network: SupportedNetworks,
  options: TimeseriesOptions,
): Promise<HistoricalDataSuccessResult | null> => {
  try {
    const response = await morphoGraphqlFetcher<HistoricalDataGraphQLResponse>(
      marketHistoricalDataQuery,
      {
        uniqueKey,
        options,
        chainId: network,
      },
    );

    const historicalState = response?.data?.marketByUniqueKey?.historicalState;

    // Check if historicalState exists and has *any* relevant data points (e.g., supplyApy)
    // This check might need refinement based on what fields are essential
    if (
      !historicalState ||
      Object.keys(historicalState).length === 0 ||
      !historicalState.supplyApy
    ) {
      // Example check
      console.warn(
        'Historical state not found, empty, or missing essential data in Morpho API response for',
        uniqueKey,
      );
      return null;
    }

    // Construct the expected nested structure for the hook
    // Assume API returns *some* data if historicalState is valid
    const rates: MarketRates = {
      supplyApy: historicalState.supplyApy ?? [],
      borrowApy: historicalState.borrowApy ?? [],
      rateAtUTarget: historicalState.rateAtUTarget ?? [],
      utilization: historicalState.utilization ?? [],
    };
    const volumes: MarketVolumes = {
      supplyAssetsUsd: historicalState.supplyAssetsUsd ?? [],
      borrowAssetsUsd: historicalState.borrowAssetsUsd ?? [],
      liquidityAssetsUsd: historicalState.liquidityAssetsUsd ?? [],
      supplyAssets: historicalState.supplyAssets ?? [],
      borrowAssets: historicalState.borrowAssets ?? [],
      liquidityAssets: historicalState.liquidityAssets ?? [],
    };

    // Sort each timeseries array by timestamp (x-axis) ascending
    const sortByTimestamp = (a: TimeseriesDataPoint, b: TimeseriesDataPoint) => a.x - b.x;
    Object.values(rates).forEach((arr) => arr.sort(sortByTimestamp));
    Object.values(volumes).forEach((arr) => arr.sort(sortByTimestamp));

    return { rates, volumes };
  } catch (error) {
    console.error('Error fetching Morpho historical data:', error);
    return null; // Return null on error
  }
};
