import { type Address, formatUnits, type PublicClient } from 'viem';
import { abi as chainlinkOracleAbi } from '@/abis/chainlinkOraclev2';
import morphoABI from '@/abis/morpho';
import { getMorphoAddress } from './morpho';
import type { SupportedNetworks } from './networks';
import type { Market as MorphoMarket, MarketPosition, MarketPositionWithEarnings, GroupedPosition } from './types';

export type PositionSnapshot = {
  supplyAssets: string;
  supplyShares: string;
  borrowAssets: string;
  borrowShares: string;
  collateral: string;
};

export type MarketSnapshot = {
  totalSupplyAssets: string;
  totalSupplyShares: string;
  totalBorrowAssets: string;
  totalBorrowShares: string;
  liquidityAssets: string;
  lastUpdate: number;
  fee: string;
};

const MARKET_SNAPSHOT_BATCH_SIZE = 200;
const MARKET_SNAPSHOT_PARALLEL_BATCHES = 4;

// Types for contract responses
type Position = {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
};

type MorphoMarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

export type PositionMarketOracleInput = {
  marketUniqueKey: string;
  oracleAddress?: string | null;
};

export type PositionSnapshotsWithOracleResult = {
  snapshots: Map<string, PositionSnapshot>;
  oraclePrices: Map<string, string | null>;
};

export type BorrowPositionRow = {
  market: MorphoMarket;
  state: {
    borrowAssets: string;
    borrowShares: string;
    collateral: string;
  };
  oraclePrice: string | null;
  borrowAmount: number;
  collateralAmount: number;
  isActiveDebt: boolean;
};

const ONE_YEAR_IN_SECONDS = 86_400 * 365;

function normalizeOraclePriceResult(value: unknown): string | null {
  if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string') {
    return value.toString();
  }
  return null;
}

// Helper functions
function arrayToPosition(arr: readonly bigint[]): Position {
  return {
    supplyShares: arr[0],
    borrowShares: arr[1],
    collateral: arr[2],
  };
}

function arrayToMarket(arr: readonly bigint[]): MorphoMarketState {
  return {
    totalSupplyAssets: arr[0],
    totalSupplyShares: arr[1],
    totalBorrowAssets: arr[2],
    totalBorrowShares: arr[3],
    lastUpdate: arr[4],
    fee: arr[5],
  };
}

export function convertSharesToAssets(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  if (totalShares === 0n) return 0n;
  return (shares * totalAssets) / totalShares;
}

/**
 * Fetches position snapshots for multiple markets using multicall for efficiency.
 * All markets must be on the same chain, for the same user, at the same block.
 *
 * @param marketIds - Array of market unique IDs
 * @param userAddress - The user's address
 * @param chainId - The chain ID of the network
 * @param blockNumber - The block number to fetch positions at (undefined for latest)
 * @param client - The viem PublicClient to use for the request
 * @returns Map of marketId to PositionSnapshot
 */
export async function fetchPositionsSnapshots(
  marketIds: string[],
  userAddress: Address,
  chainId: number,
  blockNumber: number | undefined,
  client: PublicClient,
): Promise<Map<string, PositionSnapshot>> {
  const result = new Map<string, PositionSnapshot>();

  if (marketIds.length === 0) {
    return result;
  }

  try {
    const isLatest = blockNumber === undefined;
    const morphoAddress = getMorphoAddress(chainId as SupportedNetworks);

    // Step 1: Multicall to get all position data
    const positionContracts = marketIds.map((marketId) => ({
      address: morphoAddress as `0x${string}`,
      abi: morphoABI,
      functionName: 'position' as const,
      args: [marketId as `0x${string}`, userAddress],
    }));

    const positionResults = await client.multicall({
      contracts: positionContracts,
      allowFailure: true,
      blockNumber: isLatest ? undefined : BigInt(blockNumber),
    });

    // Process position results and identify which markets need market data
    const positions = new Map<string, Position>();
    const marketsNeedingData: string[] = [];

    positionResults.forEach((posResult, index) => {
      const marketId = marketIds[index];
      if (posResult.status === 'success' && posResult.result) {
        const position = arrayToPosition(posResult.result as readonly bigint[]);
        positions.set(marketId, position);

        // Check if this position has any shares/collateral
        if (position.supplyShares !== 0n || position.borrowShares !== 0n || position.collateral !== 0n) {
          marketsNeedingData.push(marketId);
        } else {
          // No shares, set zero snapshot immediately
          result.set(marketId, {
            supplyShares: '0',
            supplyAssets: '0',
            borrowShares: '0',
            borrowAssets: '0',
            collateral: '0',
          });
        }
      } else {
        console.warn(`Failed to fetch position for market ${marketId}`);
      }
    });

    // Step 2: Multicall to get market data for positions with shares
    if (marketsNeedingData.length > 0) {
      const marketContracts = marketsNeedingData.map((marketId) => ({
        address: morphoAddress as `0x${string}`,
        abi: morphoABI,
        functionName: 'market' as const,
        args: [marketId as `0x${string}`],
      }));

      const marketResults = await client.multicall({
        contracts: marketContracts,
        allowFailure: true,
        blockNumber: isLatest ? undefined : BigInt(blockNumber),
      });

      // Process market results and create final snapshots
      marketResults.forEach((marketResult, index) => {
        const marketId = marketsNeedingData[index];
        const position = positions.get(marketId);

        if (!position) return;

        if (marketResult.status === 'success' && marketResult.result) {
          const market = arrayToMarket(marketResult.result as readonly bigint[]);

          const supplyAssets = convertSharesToAssets(position.supplyShares, market.totalSupplyAssets, market.totalSupplyShares);

          const borrowAssets = convertSharesToAssets(position.borrowShares, market.totalBorrowAssets, market.totalBorrowShares);

          result.set(marketId, {
            supplyShares: position.supplyShares.toString(),
            supplyAssets: supplyAssets.toString(),
            borrowShares: position.borrowShares.toString(),
            borrowAssets: borrowAssets.toString(),
            collateral: position.collateral.toString(),
          });
        } else {
          console.warn(`Failed to fetch market data for ${marketId}`);
        }
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching position snapshots:', {
      marketIds,
      userAddress,
      blockNumber,
      chainId,
      error,
    });
    return result;
  }
}

/**
 * Fetches latest position snapshots plus live oracle prices in batched multicalls.
 *
 * @param markets - Array of market keys and oracle addresses
 * @param userAddress - The user's address
 * @param chainId - The chain ID of the network
 * @param client - The viem PublicClient to use for the request
 * @returns Snapshots and oracle prices keyed by market key (lowercase)
 */
export async function fetchLatestPositionSnapshotsWithOraclePrices(
  markets: PositionMarketOracleInput[],
  userAddress: Address,
  chainId: number,
  client: PublicClient,
): Promise<PositionSnapshotsWithOracleResult> {
  const snapshots = new Map<string, PositionSnapshot>();
  const oraclePrices = new Map<string, string | null>();

  if (markets.length === 0) {
    return { snapshots, oraclePrices };
  }

  const marketIds = markets.map((market) => market.marketUniqueKey);
  const latestSnapshots = await fetchPositionsSnapshots(marketIds, userAddress, chainId, undefined, client);

  latestSnapshots.forEach((snapshot, marketId) => {
    snapshots.set(marketId.toLowerCase(), snapshot);
  });

  const marketsWithOracle = markets.filter((market) => market.oracleAddress);
  if (marketsWithOracle.length === 0) {
    return { snapshots, oraclePrices };
  }

  try {
    const oracleContracts = marketsWithOracle.map((market) => ({
      address: market.oracleAddress as `0x${string}`,
      abi: chainlinkOracleAbi,
      functionName: 'price' as const,
    }));

    const oracleResults = await client.multicall({
      contracts: oracleContracts,
      allowFailure: true,
    });

    oracleResults.forEach((oracleResult, index) => {
      const marketKey = marketsWithOracle[index]?.marketUniqueKey.toLowerCase();
      if (!marketKey) return;

      if (oracleResult.status === 'success' && oracleResult.result !== undefined && oracleResult.result !== null) {
        const normalizedPrice = normalizeOraclePriceResult(oracleResult.result);
        oraclePrices.set(marketKey, normalizedPrice);
      } else {
        oraclePrices.set(marketKey, null);
      }
    });

    return { snapshots, oraclePrices };
  } catch (error) {
    console.error('Error fetching batched oracle prices:', {
      chainId,
      marketCount: marketsWithOracle.length,
      error,
    });
    return { snapshots, oraclePrices };
  }
}

/**
 * Fetches a position snapshot for a specific market, user, and block number using a PublicClient
 *
 * @param marketId - The unique ID of the market
 * @param userAddress - The user's address
 * @param chainId - The chain ID of the network
 * @param blockNumber - The block number to fetch the position at (undefined for latest)
 * @param client - The viem PublicClient to use for the request
 * @returns The position snapshot or null if there was an error
 */
export async function fetchPositionSnapshot(
  marketId: string,
  userAddress: Address,
  chainId: number,
  blockNumber: number | undefined,
  client: PublicClient,
): Promise<PositionSnapshot | null> {
  const snapshots = await fetchPositionsSnapshots([marketId], userAddress, chainId, blockNumber, client);
  return snapshots.get(marketId) ?? null;
}

/**
 * Fetches a market snapshot for a specific market and block number using a PublicClient
 *
 * @param marketId - The unique ID of the market
 * @param chainId - The chain ID of the network
 * @param blockNumber - The block number to fetch the market at (undefined for latest)
 * @param client - The viem PublicClient to use for the request
 * @returns The market snapshot or null if there was an error
 */
export async function fetchMarketSnapshot(
  marketId: string,
  chainId: number,
  client: PublicClient,
  blockNumber?: number,
): Promise<MarketSnapshot | null> {
  const snapshots = await fetchMarketsSnapshots([marketId], chainId, client, blockNumber);
  return snapshots.get(marketId.toLowerCase()) ?? null;
}

export async function fetchMarketsSnapshots(
  marketIds: string[],
  chainId: number,
  client: PublicClient,
  blockNumber?: number,
): Promise<Map<string, MarketSnapshot>> {
  const snapshots = new Map<string, MarketSnapshot>();

  if (marketIds.length === 0) {
    return snapshots;
  }

  try {
    const isLatest = blockNumber === undefined;
    const morphoAddress = getMorphoAddress(chainId as SupportedNetworks);

    for (let waveStart = 0; waveStart < marketIds.length; waveStart += MARKET_SNAPSHOT_BATCH_SIZE * MARKET_SNAPSHOT_PARALLEL_BATCHES) {
      const waveChunks: string[][] = [];

      for (let chunkIndex = 0; chunkIndex < MARKET_SNAPSHOT_PARALLEL_BATCHES; chunkIndex += 1) {
        const chunkStart = waveStart + chunkIndex * MARKET_SNAPSHOT_BATCH_SIZE;
        if (chunkStart >= marketIds.length) {
          break;
        }

        waveChunks.push(marketIds.slice(chunkStart, chunkStart + MARKET_SNAPSHOT_BATCH_SIZE));
      }

      const waveResults = await Promise.all(
        waveChunks.map((marketChunk) =>
          client.multicall({
            contracts: marketChunk.map((currentMarketId) => ({
              address: morphoAddress as `0x${string}`,
              abi: morphoABI,
              functionName: 'market' as const,
              args: [currentMarketId as `0x${string}`],
            })),
            allowFailure: true,
            blockNumber: isLatest ? undefined : BigInt(blockNumber),
          }),
        ),
      );

      waveResults.forEach((results, waveIndex) => {
        const marketChunk = waveChunks[waveIndex] ?? [];

        results.forEach((result, resultIndex) => {
          if (result.status !== 'success' || !result.result) {
            return;
          }

          const marketId = marketChunk[resultIndex];
          if (!marketId) {
            return;
          }

          const market = arrayToMarket(result.result as readonly bigint[]);
          const liquidityAssets = market.totalSupplyAssets - market.totalBorrowAssets;

          snapshots.set(marketId.toLowerCase(), {
            totalSupplyAssets: market.totalSupplyAssets.toString(),
            totalSupplyShares: market.totalSupplyShares.toString(),
            totalBorrowAssets: market.totalBorrowAssets.toString(),
            totalBorrowShares: market.totalBorrowShares.toString(),
            liquidityAssets: liquidityAssets.toString(),
            lastUpdate: Number(market.lastUpdate),
            fee: market.fee.toString(),
          });
        });
      });
    }

    return snapshots;
  } catch (error) {
    console.error('Error reading market:', {
      marketIds,
      chainId,
      blockNumber,
      error,
    });
    return snapshots;
  }
}

/**
 * Get combined earnings for a group of positions
 *
 * @param groupedPosition - The grouped position
 * @returns The total earnings as a string
 */
export function getGroupedEarnings(groupedPosition: GroupedPosition): bigint {
  let total = 0n;

  for (const position of groupedPosition.markets) {
    const earnings = position.earned;
    if (earnings) {
      total += BigInt(earnings);
    }
  }

  return total;
}

/**
 * Get grouped actual APY for a group of positions.
 * Aggregate earnings and capital-time first, then annualize once at the group level.
 *
 * @param groupedPosition - The grouped position
 * @param chainBlockData - Period start block/timestamp keyed by chain ID
 * @param endTimestamp - Period end timestamp
 * @returns The grouped actual APY as a number
 */
export function getGroupedActualApy(
  groupedPosition: GroupedPosition,
  chainBlockData: Record<number, { block: number; timestamp: number }>,
  endTimestamp: number = Math.floor(Date.now() / 1000),
): number {
  const startTimestamp = chainBlockData[groupedPosition.chainId]?.timestamp;
  if (!startTimestamp || endTimestamp <= startTimestamp) return 0;

  const fullWindowSeconds = endTimestamp - startTimestamp;
  let totalEarned = 0n;
  let totalCapitalTime = 0n;

  for (const position of groupedPosition.markets) {
    const avgCapital = BigInt(position.avgCapital ?? '0');
    const effectiveTime = BigInt(Math.max(0, position.effectiveTime ?? 0));
    const capitalTime = avgCapital * effectiveTime;
    if (capitalTime <= 0n) continue;

    totalEarned += BigInt(position.earned ?? '0');
    totalCapitalTime += capitalTime;
  }

  if (totalCapitalTime <= 0n || totalEarned <= 0n) return 0;

  const averageCapital = totalCapitalTime / BigInt(fullWindowSeconds);
  if (averageCapital <= 0n) return 0;

  const earnedAsNumber = Number(formatUnits(totalEarned, groupedPosition.loanAssetDecimals));
  const averageCapitalAsNumber = Number(formatUnits(averageCapital, groupedPosition.loanAssetDecimals));
  if (!Number.isFinite(earnedAsNumber) || !Number.isFinite(averageCapitalAsNumber) || averageCapitalAsNumber <= 0) return 0;

  const periods = ONE_YEAR_IN_SECONDS / fullWindowSeconds;
  const base = earnedAsNumber / averageCapitalAsNumber + 1;

  if (!Number.isFinite(periods) || periods <= 0 || periods > 1_000_000) return 0;
  if (!Number.isFinite(base) || base <= 0) return 0;

  const annualized = base ** periods - 1;
  return Number.isFinite(annualized) ? annualized : 0;
}

/**
 * Group positions by loan asset
 *
 * @param positions - Array of positions with earnings
 * @returns Array of grouped positions
 */
export function groupPositionsByLoanAsset(
  positions: MarketPositionWithEarnings[],
  chainBlockData: Record<number, { block: number; timestamp: number }>,
): GroupedPosition[] {
  return positions
    .filter((position) => BigInt(position.state.supplyShares) > 0)
    .reduce((acc: GroupedPosition[], position) => {
      const loanAssetAddress = position.market.loanAsset.address;
      const loanAssetDecimals = position.market.loanAsset.decimals;
      const chainId = position.market.morphoBlue.chain.id;

      let groupedPosition = acc.find((gp) => gp.loanAssetAddress === loanAssetAddress && gp.chainId === chainId);

      if (!groupedPosition) {
        groupedPosition = {
          loanAsset: position.market.loanAsset.symbol || 'Unknown',
          loanAssetAddress,
          loanAssetDecimals,
          loanAssetSymbol: position.market.loanAsset.symbol || 'Unknown',
          chainId,
          totalSupply: 0,
          totalWeightedApy: 0,
          actualApy: 0,
          collaterals: [],
          markets: [],
          processedCollaterals: [],
          allWarnings: [],
        };
        acc.push(groupedPosition);
      }

      // Check if position should be included in the group
      const shouldInclude = BigInt(position.state.supplyShares) > 0 || position.earned !== '0';

      if (shouldInclude) {
        groupedPosition.markets.push(position);

        const supplyAmount = Number(formatUnits(BigInt(position.state.supplyAssets), loanAssetDecimals));
        groupedPosition.totalSupply += supplyAmount;

        const weightedApyContribution = supplyAmount * (position.market.state?.supplyApy ?? 0); // Use optional chaining for state
        groupedPosition.totalWeightedApy += weightedApyContribution; // Accumulate weighted APY sum

        const collateralAddress = position.market.collateralAsset?.address;
        const collateralSymbol = position.market.collateralAsset?.symbol;

        if (collateralAddress && collateralSymbol) {
          const existingCollateral = groupedPosition.collaterals.find((c) => c.address === collateralAddress);
          if (existingCollateral) {
            existingCollateral.amount += supplyAmount;
          } else {
            groupedPosition.collaterals.push({
              address: collateralAddress,
              symbol: collateralSymbol,
              amount: supplyAmount,
            });
          }
        }
      }

      return acc;
    }, [])
    .map((groupedPosition) => {
      // Calculate the final average weighted APY
      if (groupedPosition.totalSupply > 0) {
        groupedPosition.totalWeightedApy /= groupedPosition.totalSupply;
      } else {
        groupedPosition.totalWeightedApy = 0; // Avoid division by zero
      }
      // Calculate weighted actual APY across markets
      groupedPosition.actualApy = getGroupedActualApy(groupedPosition, chainBlockData);
      return groupedPosition;
    })
    .sort((a, b) => b.totalSupply - a.totalSupply);
}

/**
 * Build flat borrow rows (no grouping) for the positions page.
 * Includes active borrow positions and fully repaid positions with remaining collateral.
 */
export function buildBorrowPositionRows(positions: MarketPositionWithEarnings[]): BorrowPositionRow[] {
  return positions
    .filter((position) => {
      const borrowShares = BigInt(position.state.borrowShares);
      const collateral = BigInt(position.state.collateral);
      return borrowShares > 0n || collateral > 0n;
    })
    .map((position) => {
      const borrowShares = BigInt(position.state.borrowShares);
      const borrowAssets = BigInt(position.state.borrowAssets);
      const collateralAssets = BigInt(position.state.collateral);
      const collateralAsset = position.market.collateralAsset;
      const hasCollateralAsset = typeof collateralAsset?.decimals === 'number';

      const isActiveDebt = borrowShares > 0n;

      return {
        market: position.market,
        state: {
          borrowAssets: position.state.borrowAssets,
          borrowShares: position.state.borrowShares,
          collateral: position.state.collateral,
        },
        oraclePrice: position.oraclePrice ?? null,
        borrowAmount: Number(formatUnits(borrowAssets, position.market.loanAsset.decimals)),
        collateralAmount: hasCollateralAsset ? Number(formatUnits(collateralAssets, collateralAsset.decimals)) : 0,
        isActiveDebt,
      };
    })
    .sort((a, b) => {
      if (a.isActiveDebt !== b.isActiveDebt) {
        return a.isActiveDebt ? -1 : 1;
      }
      if (b.borrowAmount !== a.borrowAmount) {
        return b.borrowAmount - a.borrowAmount;
      }
      return b.collateralAmount - a.collateralAmount;
    });
}

/**
 * Process collaterals for grouped positions, simplifying small collaterals into an "Others" category
 *
 * @param groupedPositions - Array of grouped positions
 * @returns Processed grouped positions with simplified collaterals
 */
export function processCollaterals(groupedPositions: GroupedPosition[]): GroupedPosition[] {
  return groupedPositions.map((position) => {
    const sortedCollaterals = [...position.collaterals].sort((a, b) => b.amount - a.amount);
    const totalSupply = position.totalSupply;
    const processedCollaterals = [];
    let othersAmount = 0;

    for (const collateral of sortedCollaterals) {
      const percentage = (collateral.amount / totalSupply) * 100;
      if (percentage >= 5) {
        processedCollaterals.push({ ...collateral, percentage });
      } else {
        othersAmount += collateral.amount;
      }
    }

    if (othersAmount > 0) {
      const othersPercentage = (othersAmount / totalSupply) * 100;
      processedCollaterals.push({
        address: 'others',
        symbol: 'Others',
        amount: othersAmount,
        percentage: othersPercentage,
      });
    }

    return { ...position, processedCollaterals };
  });
}

/**
 * Initialize positions with empty earnings data
 *
 * @param positions - Original positions without earnings data
 * @returns Positions with initialized empty earnings
 */
export function initializePositionsWithEmptyEarnings(positions: MarketPosition[]): MarketPositionWithEarnings[] {
  return positions.map((position) => ({
    ...position,
    earned: '0',
    actualApy: 0,
    avgCapital: '0',
    effectiveTime: 0,
    totalDeposits: '0',
    totalWithdraws: '0',
  }));
}
