import { useQuery } from '@tanstack/react-query';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import {
  TimeseriesOptions,
  TimeseriesDataPoint, // Assuming this is exported
  HistoricalData,      // Use HistoricalData which contains MarketRates & MarketVolumes
} from '../utils/types';
import { marketHourlySnapshotsQuery } from '../graphql/morpho-subgraph-queries';

// Define MarketRates and MarketVolumes locally based on their structure in types.ts
// Ideally, these should be exported from src/utils/types.ts
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


// --- Local Type Definitions (Subgraph Specific) ---
interface SubgraphInterestRate {
  id: string;
  rate: string; 
  side: 'LENDER' | 'BORROWER';
  type: 'VARIABLE' | 'STABLE' | 'FIXED'; 
}

interface SubgraphMarketHourlySnapshot {
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
}
// --- End Local Type Definitions ---


// Helper function 
const subgraphGraphqlFetcher = async <T extends { data?: any; errors?: any }>( 
  apiUrl: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Network response was not ok (status: ${response.status})`);
  }

  const result = (await response.json()) as T;

  if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
    console.error('Subgraph Query Errors:', result.errors);
    throw new Error(`Subgraph query failed: ${result.errors[0].message}`);
  }

  if (!result.data) {
     console.error('Subgraph response missing data field:', result);
     throw new Error('Subgraph query response did not contain data.');
  }

  return result;
};

// Define response type based on the query structure
interface SubgraphMarketHourlySnapshotQueryResponse {
  data: {
    marketHourlySnapshots: SubgraphMarketHourlySnapshot[];
  };
}

// Define the structure for the hook's return data
export interface TransformedSubgraphHistoricalData {
  rates: MarketRates;
  volumes: MarketVolumes; 
}

// Helper to create an empty MarketRates/MarketVolumes structure
const createEmptyHistoricalStructure = (): TransformedSubgraphHistoricalData => ({
  rates: { supplyApy: [], borrowApy: [], rateAtUTarget: [], utilization: [] }, 
  volumes: {
    supplyAssetsUsd: [], borrowAssetsUsd: [], liquidityAssetsUsd: [],
    supplyAssets: [], borrowAssets: [], liquidityAssets: [], 
  },
});

const transformSubgraphSnapshots = (
  snapshots: SubgraphMarketHourlySnapshot[] | undefined
): TransformedSubgraphHistoricalData => {
  const result = createEmptyHistoricalStructure();

  if (!snapshots) {
    return result;
  }

  snapshots.forEach(snapshot => {
    const timestamp = parseInt(snapshot.timestamp, 10);
    if (isNaN(timestamp)) {
        console.warn("Skipping snapshot due to invalid timestamp:", snapshot);
        return; 
    }

    // Process Rates (APY)
    const snapshotRates = Array.isArray(snapshot.rates) ? snapshot.rates : [];
    const supplyRate = snapshotRates.find((r: SubgraphInterestRate | null | undefined) => r?.side === 'LENDER');
    const borrowRate = snapshotRates.find((r: SubgraphInterestRate | null | undefined) => r?.side === 'BORROWER');
    
    const supplyApyValue = supplyRate?.rate ? parseFloat(supplyRate.rate) : 0;
    const borrowApyValue = borrowRate?.rate ? parseFloat(borrowRate.rate) : 0;
    
    result.rates.supplyApy.push({ x: timestamp, y: !isNaN(supplyApyValue) ? supplyApyValue : 0 });
    result.rates.borrowApy.push({ x: timestamp, y: !isNaN(borrowApyValue) ? borrowApyValue : 0 });
    
    // Placeholders for data not directly available in subgraph snapshots
    result.rates.rateAtUTarget.push({ x: timestamp, y: 0 });
    result.rates.utilization.push({ x: timestamp, y: 0 });

    // no USD values available in subgraph
    const finalSupplyUsd = 0;
    const finalBorrowUsd = 0;
    const finalLiquidityUsd = 0;

    const supplyNative = BigInt(snapshot.inputTokenBalance ?? '0');
    const borrowNative = BigInt(snapshot.variableBorrowedTokenBalance ?? '0');
    const liquidityNative = supplyNative - borrowNative;

    result.volumes.supplyAssetsUsd.push({ x: timestamp, y: finalSupplyUsd });
    result.volumes.borrowAssetsUsd.push({ x: timestamp, y: finalBorrowUsd });
    result.volumes.liquidityAssetsUsd.push({ x: timestamp, y: finalLiquidityUsd });

    // Process Native asset amounts 
    

    // Convert BigInt to number for TimeseriesDataPoint. 
    // Warning: Potential precision loss for very large numbers.
    // Consider formatting units in the UI instead if precision is critical.
    result.volumes.supplyAssets.push({ x: timestamp, y: Number(supplyNative) }); 
    result.volumes.borrowAssets.push({ x: timestamp, y: Number(borrowNative) }); 
    result.volumes.liquidityAssets.push({ x: timestamp, y: Number(liquidityNative) }); 
  });

  // Sort data by timestamp
  Object.values(result.rates).forEach((arr: TimeseriesDataPoint[]) => arr.sort((a, b) => a.x - b.x));
  Object.values(result.volumes).forEach((arr: TimeseriesDataPoint[]) => arr.sort((a, b) => a.x - b.x));

  return result;
};


export const useSubgraphMarketHistoricalData = (
  marketId: string | undefined,
  network: SupportedNetworks | undefined,
  timeRange: TimeseriesOptions | undefined,
) => {
  return useQuery<TransformedSubgraphHistoricalData | null>({
    queryKey: ['subgraphMarketHistoricalData', marketId, network, timeRange?.startTimestamp, timeRange?.endTimestamp, timeRange?.interval],
    queryFn: async (): Promise<TransformedSubgraphHistoricalData | null> => {
      if (!marketId || !network || !timeRange || !timeRange.startTimestamp || !timeRange.endTimestamp) {
        return createEmptyHistoricalStructure(); 
      }

      const subgraphApiUrl = getSubgraphUrl(network);
      if (!subgraphApiUrl) {
        console.error(`Subgraph URL for network ${network} is not defined.`);
        return createEmptyHistoricalStructure(); 
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
          variables
        );

        if (!response.data || !response.data.marketHourlySnapshots) {
            return createEmptyHistoricalStructure(); 
        }

        return transformSubgraphSnapshots(response.data.marketHourlySnapshots);

      } catch (error) {
        console.error("Error fetching or processing subgraph historical data:", error);
        return createEmptyHistoricalStructure(); 
      }
    },
    enabled: !!marketId && !!network && !!timeRange && !!timeRange.startTimestamp && !!timeRange.endTimestamp,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: (previousData) => previousData ?? createEmptyHistoricalStructure(), 
    retry: 1, 
  });
}; 