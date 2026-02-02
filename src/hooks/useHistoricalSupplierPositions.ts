import { useQuery } from '@tanstack/react-query';
import { formatUnits, type Address, type PublicClient } from 'viem';
import morphoABI from '@/abis/morpho';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { getMorphoAddress } from '@/utils/morpho';
import { fetchBlocksWithTimestamps, type BlockWithTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { calculateTimePoints, type ChartTimeframe } from '@/stores/useMarketDetailChartState';
import type { MarketSupplier } from '@/utils/types';

type SupplierPositionDataPoint = {
  timestamp: number; // actual block timestamp
  targetTimestamp: number; // original target timestamp
  blockNumber: number;
  [key: string]: number; // supplier addresses as keys, supply assets as values
};

type SupplierInfo = {
  address: string;
  currentSupply: bigint;
};

type UseHistoricalSupplierPositionsResult = {
  data: SupplierPositionDataPoint[] | null;
  suppliers: SupplierInfo[];
  isLoading: boolean;
  error: Error | null;
};

type MarketDataRaw = readonly [bigint, bigint, bigint, bigint, bigint, bigint];
type PositionDataRaw = readonly [bigint, bigint, bigint];

// Limit suppliers to fetch historical data for
const TOP_SUPPLIERS_LIMIT = 15;
// Number of blocks to process in parallel per batch
const PARALLEL_BATCH_SIZE = 5;

/**
 * Fetch position data for a single block.
 * Returns null only if the market doesn't exist at that block (before creation).
 */
async function fetchBlockData(
  client: PublicClient,
  morphoAddress: Address,
  marketId: string,
  suppliers: SupplierInfo[],
  block: BlockWithTimestamp,
  loanAssetDecimals: number,
): Promise<SupplierPositionDataPoint | null> {
  try {
    // Build multicall contracts: market state + positions for all suppliers
    const contracts = [
      {
        address: morphoAddress,
        abi: morphoABI,
        functionName: 'market' as const,
        args: [marketId as `0x${string}`],
      },
      ...suppliers.map((supplier) => ({
        address: morphoAddress,
        abi: morphoABI,
        functionName: 'position' as const,
        args: [marketId as `0x${string}`, supplier.address as Address],
      })),
    ];

    const results = await client.multicall({
      contracts,
      allowFailure: true,
      blockNumber: BigInt(block.blockNumber),
    });

    // Parse market state
    const marketResult = results[0];
    if (marketResult.status !== 'success' || !marketResult.result) {
      // Market doesn't exist at this block (before creation)
      return null;
    }

    const marketData = marketResult.result as MarketDataRaw;
    const blockTotalSupplyAssets = marketData[0];
    const blockTotalSupplyShares = marketData[1];

    // If market has no supply, it might be before first deposit - still return data point with zeros
    const dataPoint: SupplierPositionDataPoint = {
      timestamp: block.timestamp,
      targetTimestamp: block.targetTimestamp,
      blockNumber: block.blockNumber,
    };

    for (const [index, supplier] of suppliers.entries()) {
      const positionResult = results[index + 1];
      if (positionResult.status === 'success' && positionResult.result) {
        const positionData = positionResult.result as PositionDataRaw;
        const supplyShares = positionData[0];

        // Convert shares to assets
        const supplyAssets = blockTotalSupplyShares > 0n ? (supplyShares * blockTotalSupplyAssets) / blockTotalSupplyShares : 0n;

        dataPoint[supplier.address] = Number(formatUnits(supplyAssets, loanAssetDecimals));
      } else {
        // Position doesn't exist or call failed - supplier hadn't deposited yet
        dataPoint[supplier.address] = 0;
      }
    }

    return dataPoint;
  } catch {
    // Block fetch failed - may be before chain genesis or RPC issue
    return null;
  }
}

/**
 * Hook to fetch historical position snapshots for top suppliers via multicall.
 */
export function useHistoricalSupplierPositions(
  marketId: string | undefined,
  chainId: SupportedNetworks | undefined,
  timeframe: ChartTimeframe,
  suppliers: MarketSupplier[] | null,
  totalSupplyShares: bigint,
  totalSupplyAssets: bigint,
  loanAssetDecimals: number,
): UseHistoricalSupplierPositionsResult {
  const { customRpcUrls } = useCustomRpcContext();

  // Get top suppliers by current supply shares
  const topSuppliers: SupplierInfo[] = (suppliers ?? []).slice(0, TOP_SUPPLIERS_LIMIT).map((s) => {
    const shares = BigInt(s.supplyShares);
    const assets = totalSupplyShares > 0n ? (shares * totalSupplyAssets) / totalSupplyShares : 0n;
    return {
      address: s.userAddress,
      currentSupply: assets,
    };
  });

  // Create a stable key from supplier addresses for cache invalidation
  const supplierAddressesHash = topSuppliers.map((s) => s.address).join(',');

  const { data, isLoading, error } = useQuery({
    queryKey: ['historicalSupplierPositions', marketId, chainId, timeframe, supplierAddressesHash],
    queryFn: async () => {
      if (!marketId || !chainId || topSuppliers.length === 0) {
        return null;
      }

      // Create client with custom RPC if configured (respects user's settings)
      const client = getClient(chainId, customRpcUrls[chainId]);

      const morphoAddress = getMorphoAddress(chainId) as Address;
      const currentBlock = await client.getBlockNumber();
      const currentTimestamp = Math.floor(Date.now() / 1000);

      // Use centralized timeframe config for time points
      const targetTimestamps = calculateTimePoints(timeframe, currentTimestamp);

      // Fetch all blocks with real timestamps in parallel
      const blocksWithTimestamps = await fetchBlocksWithTimestamps(
        client,
        chainId,
        targetTimestamps,
        Number(currentBlock),
        currentTimestamp,
      );

      // Process blocks in parallel batches for position data
      const dataPoints: SupplierPositionDataPoint[] = [];

      for (let i = 0; i < blocksWithTimestamps.length; i += PARALLEL_BATCH_SIZE) {
        const batch = blocksWithTimestamps.slice(i, i + PARALLEL_BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map((block) => fetchBlockData(client, morphoAddress, marketId, topSuppliers, block, loanAssetDecimals)),
        );

        // Filter out null results and add to dataPoints
        const validResults = batchResults.filter((result): result is SupplierPositionDataPoint => result !== null);
        dataPoints.push(...validResults);
      }

      // Sort by timestamp
      dataPoints.sort((a, b) => a.timestamp - b.timestamp);

      return dataPoints;
    },
    enabled: !!marketId && !!chainId && topSuppliers.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? null,
    suppliers: topSuppliers,
    isLoading,
    error: error as Error | null,
  };
}
