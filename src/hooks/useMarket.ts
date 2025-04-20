import { useQuery } from '@tanstack/react-query';
import { SupportedNetworks } from '@/utils/networks';
import { URLS } from '@/utils/urls';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { marketDetailQuery, marketHistoricalDataQuery } from '../graphql/morpho-api-queries';
import { HistoricalData, TimeseriesOptions, Market } from '../utils/types'; // Assuming TimeseriesDataPoint is used within MarketRates/Volumes

// Define MarketRates/Volumes locally based on structure in types.ts
// as they are not exported directly
type MarketRates = {
  supplyApy: TimeseriesDataPoint[];
  borrowApy: TimeseriesDataPoint[];
  rateAtUTarget: TimeseriesDataPoint[];
  utilization: TimeseriesDataPoint[];
};

type MarketVolumes = {
  supplyAssetsUsd: TimeseriesDataPoint[];
  borrowAssetsUsd: TimeseriesDataPoint[];
  liquidityAssetsUsd: TimeseriesDataPoint[];
  supplyAssets: TimeseriesDataPoint[];
  borrowAssets: TimeseriesDataPoint[];
  liquidityAssets: TimeseriesDataPoint[];
};
// We need TimeseriesDataPoint too
type TimeseriesDataPoint = {
  x: number;
  y: number;
};


type MarketGraphQLResponse = {
  data: {
    marketByUniqueKey: Market;
  };
  errors?: { message: string }[];
};

// Specific type for the historical data query response
// It returns a Market object augmented with historicalState
type MarketWithHistoricalState = Market & {
  historicalState: {
    rates: MarketRates;
    volumes: MarketVolumes;
  } | null; // Allow null if no data
};

type HistoricalDataGraphQLResponse = {
  data: {
    marketByUniqueKey: MarketWithHistoricalState;
  };
  errors?: { message: string }[];
};

// Generic fetcher, the caller needs to handle the specific data structure
// Add constraint to T
const graphqlFetcher = async <T extends Record<string, any>>( 
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(URLS.MORPHO_BLUE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const result = (await response.json()) as T; // Cast to generic T

  // Check for errors at the top level
  if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  return result;
};

const processMarketData = (market: Market): Market => {
  const warningsWithDetail = getMarketWarningsWithDetail(market);

  return {
    ...market,
    warningsWithDetail,
    isProtectedByLiquidationBots: false, // NOT needed for now, might implement later
  };
};

export const useMarket = (uniqueKey: string, network: SupportedNetworks) => {
  return useQuery<Market>({ // Expects Market type
    queryKey: ['market', uniqueKey, network],
    queryFn: async () => {
      // Fetcher returns MarketGraphQLResponse here
      const response = await graphqlFetcher<MarketGraphQLResponse>(marketDetailQuery, { uniqueKey, chainId: network });
      if (!response.data || !response.data.marketByUniqueKey) {
        throw new Error('Market data not found in response');
      }
      return processMarketData(response.data.marketByUniqueKey);
    },
  });
};

// Return type matching the structure within historicalState
export type HistoricalDataResult = {
  rates: MarketRates | null;
  volumes: MarketVolumes | null;
} | null; // Allow null for loading/error states

export const useMarketHistoricalData = (
  uniqueKey: string | undefined,
  network: SupportedNetworks | undefined,
  // Rate and Volume options seem unused separately now?
  // The query fetches both. Let's simplify to one options object.
  options: TimeseriesOptions | undefined, 
) => {
  // This query now returns the historicalState object containing both rates and volumes
  const { data, isLoading, error, refetch } = useQuery<HistoricalDataResult>({ 
    queryKey: ['marketHistoricalData', uniqueKey, network, options?.startTimestamp, options?.endTimestamp, options?.interval],
    queryFn: async (): Promise<HistoricalDataResult> => {
      if (!uniqueKey || !network || !options) return null;

      // Use the specific response type for historical data
      const response = await graphqlFetcher<HistoricalDataGraphQLResponse>(marketHistoricalDataQuery, {
        uniqueKey,
        options,
        chainId: network,
      });

      // Access historicalState correctly
      const historicalState = response?.data?.marketByUniqueKey?.historicalState;

      if (!historicalState) {
        console.warn("Historical state not found in response for", uniqueKey);
        return { rates: null, volumes: null }; // Return empty structure
      }

      // The API returns the structure we need directly
      return {
          rates: historicalState.rates,
          volumes: historicalState.volumes
      };
    },
    enabled: !!uniqueKey && !!network && !!options, 
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: (previousData) => previousData ?? null,
  });

  
  return {
    data: data, // Contains { rates: MarketRates | null, volumes: MarketVolumes | null } | null
    isLoading: isLoading,
    error: error,
    refetch: refetch, // Refetches the combined historical data
  };
};
