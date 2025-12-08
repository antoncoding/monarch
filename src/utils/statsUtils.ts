import { formatUnits } from 'viem';

export type TimeFrame = '1D' | '7D' | '30D' | '90D' | 'ALL';
export type MetricPeriod = 'daily' | 'weekly' | 'monthly';

export type Transaction = {
  id: string;
  user: string;
  timestamp: string;
  network: string;
  hash: string;
  blockNumber: string;
  supplyVolume: string;
  withdrawVolume: string;
  supplyCount: number;
  withdrawCount: number;
  chainId?: number;
  market?: string;
  supplies?: {
    id: string;
    market?: {
      id: string;
      loan: string;
      collateral?: string;
    };
    amount: string;
  }[];
  withdrawals?: {
    id: string;
    market?: {
      id: string;
      loan: string;
      collateral?: string;
    };
    amount: string;
  }[];
};

export type TimeSeriesData = {
  date: string;
  value: number;
};

export type AssetVolumeData = {
  assetAddress: string;
  assetSymbol?: string;
  chainId?: number;
  supplyVolume: string;
  withdrawVolume: string;
  totalVolume: string;
  supplyCount: number;
  withdrawCount: number;
  uniqueUsers: number;
};

export type PlatformStats = {
  uniqueUsers: number;
  uniqueUsersDelta: number;
  totalTransactions: number;
  totalTransactionsDelta: number;
  supplyCount: number;
  supplyCountDelta: number;
  withdrawCount: number;
  withdrawCountDelta: number;
  activeMarkets: number;
};

/**
 * Calculates timestamp range based on the selected time frame
 */
export const getTimeRange = (timeframe: TimeFrame): { startTime: number; endTime: number } => {
  const now = Math.floor(Date.now() / 1000);
  let startTime = now;

  switch (timeframe) {
    case '1D':
      startTime = now - 24 * 60 * 60;
      break;
    case '7D':
      startTime = now - 7 * 24 * 60 * 60;
      break;
    case '30D':
      startTime = now - 30 * 24 * 60 * 60;
      break;
    case '90D':
      startTime = now - 90 * 24 * 60 * 60;
      break;
    case 'ALL':
      startTime = 0; // Beginning of time
      break;
  }

  return { startTime, endTime: now };
};

/**
 * Calculates the previous time range for delta comparisons
 */
export const getPreviousTimeRange = (timeframe: TimeFrame): { startTime: number; endTime: number } => {
  const { startTime, endTime } = getTimeRange(timeframe);
  const duration = endTime - startTime;

  return {
    startTime: startTime - duration,
    endTime: startTime,
  };
};

/**
 * Groups transactions by time period (day/week/month)
 */
export const groupTransactionsByPeriod = (transactions: Transaction[], period: MetricPeriod, tokenDecimals = 18): TimeSeriesData[] => {
  if (!transactions.length) return [];

  const grouped: Record<string, number> = {};

  transactions.forEach((tx) => {
    const date = new Date(Number(tx.timestamp) * 1000);
    let periodKey: string;

    switch (period) {
      case 'daily':
        periodKey = date.toISOString().split('T')[0];
        break;
      case 'weekly': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      }
      case 'monthly':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }

    const volume =
      Number(formatUnits(BigInt(tx.supplyVolume), tokenDecimals)) + Number(formatUnits(BigInt(tx.withdrawVolume), tokenDecimals));

    if (!grouped[periodKey]) {
      grouped[periodKey] = 0;
    }

    grouped[periodKey] += volume;
  });

  return Object.entries(grouped)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Calculates the number of unique users in a given time range
 */
export const calculateUniqueUsers = (transactions: Transaction[]): number => {
  const uniqueUserSet = new Set<string>();

  transactions.forEach((tx) => {
    uniqueUserSet.add(tx.user.toLowerCase());
  });

  return uniqueUserSet.size;
};

/**
 * Calculate percentage change between two values
 */
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Aggregates asset volumes and metrics
 */
export const aggregateAssetMetrics = (transactions: Transaction[], assetMap: Record<string, string>): AssetVolumeData[] => {
  const assetMetrics: Record<string, AssetVolumeData> = {};
  const assetUsers: Record<string, Set<string>> = {};

  transactions.forEach((tx) => {
    // Process supply events
    if (tx.supplies && Array.isArray(tx.supplies)) {
      tx.supplies.forEach((supply) => {
        if (supply.market?.loan) {
          const assetAddress = supply.market.loan.toLowerCase();

          // Initialize asset metrics if needed
          if (!assetMetrics[assetAddress]) {
            assetMetrics[assetAddress] = {
              assetAddress,
              assetSymbol: assetMap[assetAddress] ?? 'UNKNOWN',
              chainId: undefined, // Will be populated by stats service
              supplyVolume: '0',
              withdrawVolume: '0',
              totalVolume: '0',
              supplyCount: 0,
              withdrawCount: 0,
              uniqueUsers: 0,
            };
            assetUsers[assetAddress] = new Set<string>();
          }

          // Update supply metrics
          const supplyVolumeBigInt = BigInt(supply.amount ?? '0');
          assetMetrics[assetAddress].supplyVolume = (BigInt(assetMetrics[assetAddress].supplyVolume) + supplyVolumeBigInt).toString();
          assetMetrics[assetAddress].totalVolume = (BigInt(assetMetrics[assetAddress].totalVolume) + supplyVolumeBigInt).toString();
          assetMetrics[assetAddress].supplyCount += 1;

          // Track user
          assetUsers[assetAddress].add(tx.user.toLowerCase());
        }
      });
    }

    // Process withdrawal events
    if (tx.withdrawals && Array.isArray(tx.withdrawals)) {
      tx.withdrawals.forEach((withdrawal) => {
        if (withdrawal.market?.loan) {
          const assetAddress = withdrawal.market.loan.toLowerCase();

          // Initialize asset metrics if needed
          if (!assetMetrics[assetAddress]) {
            assetMetrics[assetAddress] = {
              assetAddress,
              assetSymbol: assetMap[assetAddress] ?? 'UNKNOWN',
              chainId: undefined, // Will be populated by stats service
              supplyVolume: '0',
              withdrawVolume: '0',
              totalVolume: '0',
              supplyCount: 0,
              withdrawCount: 0,
              uniqueUsers: 0,
            };
            assetUsers[assetAddress] = new Set<string>();
          }

          // Update withdrawal metrics
          const withdrawVolumeBigInt = BigInt(withdrawal.amount ?? '0');
          assetMetrics[assetAddress].withdrawVolume = (BigInt(assetMetrics[assetAddress].withdrawVolume) + withdrawVolumeBigInt).toString();
          assetMetrics[assetAddress].totalVolume = (BigInt(assetMetrics[assetAddress].totalVolume) + withdrawVolumeBigInt).toString();
          assetMetrics[assetAddress].withdrawCount += 1;

          // Track user
          assetUsers[assetAddress].add(tx.user.toLowerCase());
        }
      });
    }

    // If no detailed events but has market info, process aggregated counts
    if (
      (!tx.supplies || tx.supplies.length === 0) &&
      (!tx.withdrawals || tx.withdrawals.length === 0) &&
      tx.market &&
      typeof tx.market === 'string'
    ) {
      const assetAddress = tx.market.toLowerCase();

      // Initialize asset metrics if needed
      if (!assetMetrics[assetAddress]) {
        assetMetrics[assetAddress] = {
          assetAddress,
          assetSymbol: assetMap[assetAddress] ?? 'UNKNOWN',
          chainId: undefined, // Will be populated by stats service
          supplyVolume: '0',
          withdrawVolume: '0',
          totalVolume: '0',
          supplyCount: 0,
          withdrawCount: 0,
          uniqueUsers: 0,
        };
        assetUsers[assetAddress] = new Set<string>();
      }

      // Add counts and volumes
      assetMetrics[assetAddress].supplyCount += tx.supplyCount ?? 0;
      assetMetrics[assetAddress].withdrawCount += tx.withdrawCount ?? 0;

      // Add volumes
      const supplyVolumeBigInt = BigInt(tx.supplyVolume ?? '0');
      const withdrawVolumeBigInt = BigInt(tx.withdrawVolume ?? '0');

      assetMetrics[assetAddress].supplyVolume = (BigInt(assetMetrics[assetAddress].supplyVolume) + supplyVolumeBigInt).toString();
      assetMetrics[assetAddress].withdrawVolume = (BigInt(assetMetrics[assetAddress].withdrawVolume) + withdrawVolumeBigInt).toString();
      assetMetrics[assetAddress].totalVolume = (
        BigInt(assetMetrics[assetAddress].totalVolume) +
        supplyVolumeBigInt +
        withdrawVolumeBigInt
      ).toString();

      // Track user
      assetUsers[assetAddress].add(tx.user.toLowerCase());
    }
  });

  // Calculate unique users for each asset
  Object.keys(assetMetrics).forEach((asset) => {
    assetMetrics[asset].uniqueUsers = assetUsers[asset].size;
  });

  return Object.values(assetMetrics);
};

/**
 * Calculate platform-wide statistics
 */
export const calculatePlatformStats = (currentTransactions: Transaction[], previousTransactions: Transaction[]): PlatformStats => {
  // Current period calculations
  const uniqueUsers = calculateUniqueUsers(currentTransactions);
  const totalTransactions = currentTransactions.length;

  let supplyCount = 0;
  let withdrawCount = 0;
  const uniqueMarketsSet = new Set<string>();

  currentTransactions.forEach((tx) => {
    // Count supply and withdrawal transactions
    supplyCount += tx.supplyCount ?? 0;
    withdrawCount += tx.withdrawCount ?? 0;

    // Track unique markets
    if (tx.market) {
      uniqueMarketsSet.add(tx.market.toLowerCase());
    }

    // Also check market info in supplies and withdrawals
    if (tx.supplies) {
      tx.supplies.forEach((supply) => {
        if (supply.market?.loan) {
          uniqueMarketsSet.add(`${supply.market.loan.toLowerCase()}-${supply.market.collateral?.toLowerCase() ?? 'none'}`);
        }
      });
    }

    if (tx.withdrawals) {
      tx.withdrawals.forEach((withdrawal) => {
        if (withdrawal.market?.loan) {
          uniqueMarketsSet.add(`${withdrawal.market.loan.toLowerCase()}-${withdrawal.market.collateral?.toLowerCase() ?? 'none'}`);
        }
      });
    }
  });

  // Previous period calculations
  const previousUniqueUsers = calculateUniqueUsers(previousTransactions);
  const previousTotalTransactions = previousTransactions.length;

  let previousSupplyCount = 0;
  let previousWithdrawCount = 0;

  previousTransactions.forEach((tx) => {
    // Count previous supply and withdrawal transactions
    previousSupplyCount += tx.supplyCount ?? 0;
    previousWithdrawCount += tx.withdrawCount ?? 0;
  });

  // Calculate deltas
  const uniqueUsersDelta = calculatePercentageChange(uniqueUsers, previousUniqueUsers);
  const totalTransactionsDelta = calculatePercentageChange(totalTransactions, previousTotalTransactions);
  const supplyCountDelta = calculatePercentageChange(supplyCount, previousSupplyCount);
  const withdrawCountDelta = calculatePercentageChange(withdrawCount, previousWithdrawCount);

  return {
    uniqueUsers,
    uniqueUsersDelta,
    totalTransactions,
    totalTransactionsDelta,
    supplyCount,
    supplyCountDelta,
    withdrawCount,
    withdrawCountDelta,
    activeMarkets: uniqueMarketsSet.size,
  };
};
