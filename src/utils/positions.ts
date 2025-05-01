import { Address, formatUnits } from 'viem';
import { calculateEarningsFromSnapshot } from './interest';
import { SupportedNetworks } from './networks';
import {
  MarketPosition,
  MarketPositionWithEarnings,
  PositionEarnings,
  UserTransaction,
  GroupedPosition,
  WarningWithDetail,
  UserRebalancerInfo,
} from './types';

export type PositionSnapshot = {
  supplyAssets: string;
  supplyShares: string;
  borrowAssets: string;
  borrowShares: string;
  collateral: string;
};

type PositionResponse = {
  position: {
    supplyAssets: string;
    supplyShares: string;
    borrowAssets: string;
    borrowShares: string;
    collateral: string;
  } | null;
};

/**
 * Fetches a position snapshot for a specific market, user, and block number
 *
 * @param marketId - The unique ID of the market
 * @param userAddress - The user's address
 * @param chainId - The chain ID of the network
 * @param blockNumber - The block number to fetch the position at (0 for latest)
 * @returns The position snapshot or null if there was an error
 */
export async function fetchPositionSnapshot(
  marketId: string,
  userAddress: Address,
  chainId: number,
  blockNumber: number,
): Promise<PositionSnapshot | null> {
  try {
    console.log('fetchPositionSnapshot called', marketId, userAddress, chainId, blockNumber);

    // Fetch the position at the specified block number
    const positionResponse = await fetch(
      `/api/positions/historical?` +
        `marketId=${encodeURIComponent(marketId)}` +
        `&userAddress=${encodeURIComponent(userAddress)}` +
        `&blockNumber=${encodeURIComponent(blockNumber)}` +
        `&chainId=${encodeURIComponent(chainId)}`,
    );

    if (!positionResponse.ok) {
      const errorData = (await positionResponse.json()) as { error?: string };
      console.error('Failed to fetch position snapshot:', errorData);
      return null;
    }

    const positionData = (await positionResponse.json()) as PositionResponse;

    // If position is empty, return zeros
    if (!positionData.position) {
      return {
        supplyAssets: '0',
        supplyShares: '0',
        borrowAssets: '0',
        borrowShares: '0',
        collateral: '0',
      };
    }

    return {
      ...positionData.position,
    };
  } catch (error) {
    console.error('Error fetching position snapshot:', error);
    return null;
  }
}

/**
 * Calculates earnings for a position across different time periods
 *
 * @param position - The market position
 * @param transactions - User transactions for the position
 * @param userAddress - The user's address
 * @param chainId - The chain ID
 * @param blockNumbers - Block numbers for different time periods
 * @returns Position earnings data
 */
export async function calculateEarningsFromPeriod(
  position: MarketPosition,
  transactions: UserTransaction[],
  userAddress: Address,
  chainId: SupportedNetworks,
  blockNumbers: { day: number; week: number; month: number },
): Promise<PositionEarnings> {
  if (!blockNumbers) {
    return {
      lifetimeEarned: '0',
      last24hEarned: '0',
      last7dEarned: '0',
      last30dEarned: '0',
    };
  }

  const currentBalance = BigInt(position.state.supplyAssets);
  const marketId = position.market.uniqueKey;
  const marketTxs = transactions.filter((tx) => tx.data?.market?.uniqueKey === marketId);
  const now = Math.floor(Date.now() / 1000);

  const snapshots = await Promise.all([
    fetchPositionSnapshot(marketId, userAddress, chainId, blockNumbers.day),
    fetchPositionSnapshot(marketId, userAddress, chainId, blockNumbers.week),
    fetchPositionSnapshot(marketId, userAddress, chainId, blockNumbers.month),
  ]);

  const [snapshot24h, snapshot7d, snapshot30d] = snapshots;

  const lifetimeEarnings = calculateEarningsFromSnapshot(currentBalance, 0n, marketTxs, 0, now);
  const last24hEarnings = snapshot24h
    ? calculateEarningsFromSnapshot(
        currentBalance,
        BigInt(snapshot24h.supplyAssets),
        marketTxs,
        now - 24 * 60 * 60,
        now,
      )
    : null;
  const last7dEarnings = snapshot7d
    ? calculateEarningsFromSnapshot(
        currentBalance,
        BigInt(snapshot7d.supplyAssets),
        marketTxs,
        now - 7 * 24 * 60 * 60,
        now,
      )
    : null;
  const last30dEarnings = snapshot30d
    ? calculateEarningsFromSnapshot(
        currentBalance,
        BigInt(snapshot30d.supplyAssets),
        marketTxs,
        now - 30 * 24 * 60 * 60,
        now,
      )
    : null;

  return {
    lifetimeEarned: lifetimeEarnings.earned.toString(),
    last24hEarned: last24hEarnings ? last24hEarnings.earned.toString() : null,
    last7dEarned: last7dEarnings ? last7dEarnings.earned.toString() : null,
    last30dEarned: last30dEarnings ? last30dEarnings.earned.toString() : null,
  };
}

/**
 * Export enum for earnings period selection
 */
export enum EarningsPeriod {
  All = 'all',
  Day = '1D',
  Week = '7D',
  Month = '30D',
}

/**
 * Get the earnings value for a specific period
 *
 * @param position - Position with earnings data
 * @param period - The period to get earnings for
 * @returns The earnings value as a string
 */
export function getEarningsForPeriod(
  position: MarketPositionWithEarnings,
  period: EarningsPeriod,
): string | null {
  if (!position.earned) return '0';

  switch (period) {
    case EarningsPeriod.All:
      return position.earned.lifetimeEarned;
    case EarningsPeriod.Day:
      return position.earned.last24hEarned;
    case EarningsPeriod.Week:
      return position.earned.last7dEarned;
    case EarningsPeriod.Month:
      return position.earned.last30dEarned;
    default:
      return '0';
  }
}

/**
 * Get combined earnings for a group of positions
 *
 * @param groupedPosition - The grouped position
 * @param period - The period to get earnings for
 * @returns The total earnings as a string or null
 */
export function getGroupedEarnings(
  groupedPosition: GroupedPosition,
  period: EarningsPeriod,
): string | null {
  return (
    groupedPosition.markets
      .reduce(
        (total, position) => {
          const earnings = getEarningsForPeriod(position, period);
          if (earnings === null) return null;
          return total === null ? BigInt(earnings) : total + BigInt(earnings);
        },
        null as bigint | null,
      )
      ?.toString() ?? null
  );
}

/**
 * Group positions by loan asset
 *
 * @param positions - Array of positions with earnings
 * @param rebalancerInfos - Array of rebalancer info objects for different networks
 * @returns Array of grouped positions
 */
export function groupPositionsByLoanAsset(
  positions: MarketPositionWithEarnings[],
  rebalancerInfos: UserRebalancerInfo[] = [],
): GroupedPosition[] {
  return positions
    .filter((position) => {
      const networkRebalancerInfo = rebalancerInfos.find(
        (info) => info.network === position.market.morphoBlue.chain.id,
      );
      return (
        BigInt(position.state.supplyShares) > 0 ||
        networkRebalancerInfo?.marketCaps.some((c) => c.marketId === position.market.uniqueKey)
      );
    })
    .reduce((acc: GroupedPosition[], position) => {
      const loanAssetAddress = position.market.loanAsset.address;
      const loanAssetDecimals = position.market.loanAsset.decimals;
      const chainId = position.market.morphoBlue.chain.id;

      let groupedPosition = acc.find(
        (gp) => gp.loanAssetAddress === loanAssetAddress && gp.chainId === chainId,
      );

      if (!groupedPosition) {
        groupedPosition = {
          loanAsset: position.market.loanAsset.symbol || 'Unknown',
          loanAssetAddress,
          loanAssetDecimals,
          loanAssetSymbol: position.market.loanAsset.symbol || 'Unknown',
          chainId,
          totalSupply: 0,
          totalWeightedApy: 0,
          collaterals: [],
          markets: [],
          processedCollaterals: [],
          allWarnings: [],
        };
        acc.push(groupedPosition);
      }

      const networkRebalancerInfoForAdd = rebalancerInfos.find(
        (info) => info.network === position.market.morphoBlue.chain.id,
      );

      // Check if position should be included in the group
      const shouldInclude =
        BigInt(position.state.supplyShares) > 0 ||
        getEarningsForPeriod(position, EarningsPeriod.All) !== '0' ||
        networkRebalancerInfoForAdd?.marketCaps.some(
          (c) => c.marketId === position.market.uniqueKey,
        );

      if (shouldInclude) {
        groupedPosition.markets.push(position);

        // Restore original logic for totals, warnings, and collaterals
        groupedPosition.allWarnings = [
          ...new Set([
            ...groupedPosition.allWarnings,
            ...(position.market.warningsWithDetail || []),
          ]),
        ] as WarningWithDetail[];

        const supplyAmount = Number(
          formatUnits(BigInt(position.state.supplyAssets), loanAssetDecimals),
        );
        groupedPosition.totalSupply += supplyAmount;

        const weightedApyContribution = supplyAmount * (position.market.state?.supplyApy ?? 0); // Use optional chaining for state
        groupedPosition.totalWeightedApy += weightedApyContribution; // Accumulate weighted APY sum

        const collateralAddress = position.market.collateralAsset?.address;
        const collateralSymbol = position.market.collateralAsset?.symbol;

        if (collateralAddress && collateralSymbol) {
          const existingCollateral = groupedPosition.collaterals.find(
            (c) => c.address === collateralAddress,
          );
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
        groupedPosition.totalWeightedApy =
          groupedPosition.totalWeightedApy / groupedPosition.totalSupply;
      } else {
        groupedPosition.totalWeightedApy = 0; // Avoid division by zero
      }
      return groupedPosition;
    })
    .sort((a, b) => b.totalSupply - a.totalSupply);
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
export function initializePositionsWithEmptyEarnings(
  positions: MarketPosition[],
): MarketPositionWithEarnings[] {
  return positions.map((position) => ({
    ...position,
    earned: {
      lifetimeEarned: '0',
      last24hEarned: null,
      last7dEarned: null,
      last30dEarned: null,
    },
  }));
}
