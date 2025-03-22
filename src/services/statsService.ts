import { request, gql } from 'graphql-request';
import {
  transactionsByTimeRangeQuery,
  userGrowthQuery,
} from '@/graphql/statsQueries';
import { SupportedNetworks } from '@/utils/networks';
import { processTransactionData } from '@/utils/statsDataProcessing';
import {
  TimeFrame,
  MetricPeriod,
  Transaction,
  TimeSeriesData,
  AssetVolumeData,
  PlatformStats,
  getTimeRange,
  getPreviousTimeRange,
  groupTransactionsByPeriod,
  calculatePlatformStats,
} from '@/utils/statsUtils';
import { supportedTokens } from '@/utils/tokens';

// Default API endpoints for different networks
const DEFAULT_API_ENDPOINTS = {
  [SupportedNetworks.Base]: process.env.NEXT_PUBLIC_BASE_METRICS_API ?? 'https://api.studio.thegraph.com/query/94369/monarch-metrics/version/latest',
  [SupportedNetworks.Mainnet]: process.env.NEXT_PUBLIC_MAINNET_METRICS_API ?? 'https://api.thegraph.com/subgraphs/name/monarch/metrics-mainnet',
};

// GraphQL response types
type TransactionResponse = {
  userTransactions: Transaction[];
}

type UserGrowthResponse = {
  users: { id: string; firstTxTimestamp: string }[];
}

/**
 * Fetch transactions for a specific time range
 */
export const fetchTransactionsByTimeRange = async (
  startTime: number,
  endTime: number,
  networkId: SupportedNetworks = SupportedNetworks.Base,
  apiEndpoint?: string
): Promise<Transaction[]> => {
  try {
    // Get the API endpoint for the selected network
    const endpoint = apiEndpoint ?? DEFAULT_API_ENDPOINTS[networkId];
    
    console.log(`Fetching transactions between ${new Date(startTime * 1000).toISOString()} and ${new Date(endTime * 1000).toISOString()}`);
    console.log(`Using API endpoint: ${endpoint}`);
    
    const batchSize = 1000;
    let skip = 0;
    let allTransactions: Transaction[] = [];
    let hasMore = true;

    // Paginate through all available transactions
    while (hasMore) {
      const variables = {
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        first: batchSize,
        skip: skip,
      };

      console.log(`Fetching transactions batch: first=${batchSize}, skip=${skip}`);
      
      // Fetch data from the specified network
      const response = await request<TransactionResponse>(
        endpoint,
        gql`${transactionsByTimeRangeQuery}`,
        variables,
      ).catch(error => {
        console.warn(`Error fetching transactions from network ${networkId}:`, error);
        console.warn('GraphQL error details:', error.response?.errors);
        return { userTransactions: [] };
      });

      // Add network info to transactions
      const networkName = networkId === SupportedNetworks.Base ? 'base' : 'ethereum';
      const transactions = response.userTransactions?.map(tx => ({
        ...tx,
        network: networkName,
        chainId: networkId,
      })) ?? [];

      console.log(`Found ${transactions.length} transactions in batch (skip=${skip})`);
      
      // Add to our collection
      allTransactions = [...allTransactions, ...transactions];
      
      // Check if we should fetch more
      if (transactions.length < batchSize) {
        hasMore = false;
      } else {
        skip += batchSize;
      }
    }

    console.log(`Found a total of ${allTransactions.length} transactions after pagination`);
    
    if (allTransactions.length === 0) {
      console.warn('No transactions found in the specified time range. Check the API endpoint and time parameters.');
    } else {
      // Log some details about the first transaction to verify structure
      const sampleTx = allTransactions[0];
      console.log(`Sample transaction:`, {
        id: sampleTx.id,
        timestamp: sampleTx.timestamp,
        supplyCount: sampleTx.supplyCount,
        withdrawCount: sampleTx.withdrawCount,
        hasSupplies: Boolean(sampleTx.supplies?.length),
        hasWithdrawals: Boolean(sampleTx.withdrawals?.length),
      });
    }
    
    return allTransactions;
  } catch (error) {
    console.error('Error fetching transactions by time range:', error);
    return [];
  }
};

/**
 * Fetch user growth data
 */
export const fetchUserGrowth = async (
  timeframe: TimeFrame,
  period: MetricPeriod,
  networkId: SupportedNetworks = SupportedNetworks.Base,
  apiEndpoint?: string
): Promise<TimeSeriesData[]> => {
  try {
    const { startTime, endTime } = getTimeRange(timeframe);
    
    // Get the API endpoint for the selected network
    const endpoint = apiEndpoint ?? DEFAULT_API_ENDPOINTS[networkId];
    
    console.log(`Fetching user growth between ${new Date(startTime * 1000).toISOString()} and ${new Date(endTime * 1000).toISOString()}`);
    console.log(`Using API endpoint: ${endpoint}`);
    
    const batchSize = 1000;
    let skip = 0;
    let allUsers: { id: string; firstTxTimestamp: string }[] = [];
    let hasMore = true;

    // Paginate through all available users
    while (hasMore) {
      const variables = {
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        first: batchSize,
        skip: skip,
      };

      console.log(`Fetching users batch: first=${batchSize}, skip=${skip}`);

      // Fetch from specified network
      const response = await request<UserGrowthResponse>(
        endpoint,
        gql`${userGrowthQuery}`,
        variables,
      ).catch(error => {
        console.warn(`Error fetching user growth from network ${networkId}:`, error);
        return { users: [] };
      });

      const users = response.users ?? [];
      
      console.log(`Found ${users.length} users in batch (skip=${skip})`);
      
      // Add to our collection
      allUsers = [...allUsers, ...users];
      
      // Check if we should fetch more
      if (users.length < batchSize) {
        hasMore = false;
      } else {
        skip += batchSize;
      }
    }

    console.log(`Found a total of ${allUsers.length} users after pagination`);
    
    // Group users by their first transaction date
    const usersByDate: Record<string, number> = {};
    
    allUsers.forEach((user) => {
      const date = new Date(Number(user.firstTxTimestamp) * 1000);
      let periodKey: string;
      
      switch (period) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }
      
      if (!usersByDate[periodKey]) {
        usersByDate[periodKey] = 0;
      }
      
      usersByDate[periodKey]++;
    });
    
    // Convert to time series data format
    return Object.entries(usersByDate)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error fetching user growth:', error);
    return [];
  }
};

/**
 * Fetch volume data over time
 */
export const fetchVolumeOverTime = async (
  timeframe: TimeFrame,
  period: MetricPeriod,
  tokenDecimals = 18,
  networkId: SupportedNetworks = SupportedNetworks.Base,
  apiEndpoint?: string
): Promise<TimeSeriesData[]> => {
  try {
    console.log(`Fetching volume data for timeframe: ${timeframe}, period: ${period} from network ${networkId}`);
    const { startTime, endTime } = getTimeRange(timeframe);
    const transactions = await fetchTransactionsByTimeRange(startTime, endTime, networkId, apiEndpoint);
    
    return groupTransactionsByPeriod(transactions, period, tokenDecimals);
  } catch (error) {
    console.error('Error fetching volume over time:', error);
    return [];
  }
};

/**
 * Fetch and calculate platform-wide statistics
 */
export const fetchPlatformStats = async (
  timeframe: TimeFrame,
  networkId: SupportedNetworks = SupportedNetworks.Base,
  apiEndpoint?: string
): Promise<PlatformStats> => {
  try {
    console.log(`Fetching platform stats for timeframe: ${timeframe} from network ${networkId}`);
    const currentRange = getTimeRange(timeframe);
    const previousRange = getPreviousTimeRange(timeframe);
    
    const [currentTransactions, previousTransactions] = await Promise.all([
      fetchTransactionsByTimeRange(currentRange.startTime, currentRange.endTime, networkId, apiEndpoint),
      fetchTransactionsByTimeRange(previousRange.startTime, previousRange.endTime, networkId, apiEndpoint),
    ]);
    
    return calculatePlatformStats(currentTransactions, previousTransactions);
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return {
      uniqueUsers: 0,
      uniqueUsersDelta: 0,
      totalTransactions: 0,
      totalTransactionsDelta: 0,
      supplyCount: 0,
      supplyCountDelta: 0,
      withdrawCount: 0,
      withdrawCountDelta: 0,
      activeMarkets: 0,
    };
  }
};

/**
 * Fetch asset metrics and rankings
 */
export const fetchAssetMetrics = async (
  timeframe: TimeFrame,
  networkId: SupportedNetworks = SupportedNetworks.Base,
  apiEndpoint?: string
): Promise<AssetVolumeData[]> => {
  try {
    console.log(`Fetching asset metrics for timeframe: ${timeframe} from network ${networkId}`);
    const { startTime, endTime } = getTimeRange(timeframe);
    const transactions = await fetchTransactionsByTimeRange(startTime, endTime, networkId, apiEndpoint);
    
    console.log(`Processing ${transactions.length} transactions for asset metrics`);
    if (transactions.length > 0) {
      console.log(`Sample transaction structure:`, {
        id: transactions[0].id,
        timestamp: transactions[0].timestamp,
        supplyCount: transactions[0].supplyCount,
        withdrawCount: transactions[0].withdrawCount,
        hasSupplies: Boolean(transactions[0].supplies?.length),
        hasWithdrawals: Boolean(transactions[0].withdrawals?.length),
      });
    } else {
      console.warn('No transactions found in the specified time range');
    }
    
    // Count transactions with supplies or withdrawals
    const txWithSupplies = transactions.filter(tx => tx.supplies && tx.supplies.length > 0).length;
    const txWithWithdrawals = transactions.filter(tx => tx.withdrawals && tx.withdrawals.length > 0).length;
    console.log(`Transactions with supplies: ${txWithSupplies}, with withdrawals: ${txWithWithdrawals}`);
    
    // Build asset maps from supported tokens
    const assetSymbolMap: Record<string, string> = {};
    
    // Map all supported tokens
    supportedTokens.forEach(token => {
      token.networks.forEach(network => {
        const address = network.address.toLowerCase();
        assetSymbolMap[address] = token.symbol;
      });
    });
    
    console.log(`Processing transactions with ${Object.keys(assetSymbolMap).length} known assets`);
    
    // Use the transaction data processing utility
    const assetMetrics = processTransactionData(transactions, assetSymbolMap);
    
    // Set the chainId for all assets based on the selected network
    assetMetrics.forEach(asset => {
      asset.chainId = networkId;
    });
    
    console.log(`Processed ${assetMetrics.length} asset metrics`);
    
    // If no metrics were found, log a message
    if (assetMetrics.length === 0) {
      console.warn('No asset metrics were generated from the transaction data');
    }
    
    return assetMetrics;
  } catch (error) {
    console.error('Error fetching asset metrics:', error);
    return [];
  }
};

/**
 * Build a statistics payload with all relevant metrics
 */
export const fetchAllStatistics = async (
  timeframe: TimeFrame = '30D',
  networkId: SupportedNetworks = SupportedNetworks.Base,
  apiEndpoint?: string
): Promise<{
  platformStats: PlatformStats;
  assetMetrics: AssetVolumeData[];
}> => {
  try {
    console.log(`Fetching all statistics for timeframe: ${timeframe}, network: ${networkId}`);
    const startTime = performance.now();
    
    const [platformStats, assetMetrics] = await Promise.all([
      fetchPlatformStats(timeframe, networkId, apiEndpoint),
      fetchAssetMetrics(timeframe, networkId, apiEndpoint),
    ]);
    
    const endTime = performance.now();
    console.log(`All statistics fetched in ${endTime - startTime}ms from network ${networkId}`);
    
    return {
      platformStats,
      assetMetrics,
    };
  } catch (error) {
    console.error('Error fetching all statistics:', error);
    return {
      platformStats: {
        uniqueUsers: 0,
        uniqueUsersDelta: 0,
        totalTransactions: 0,
        totalTransactionsDelta: 0,
        supplyCount: 0,
        supplyCountDelta: 0,
        withdrawCount: 0,
        withdrawCountDelta: 0,
        activeMarkets: 0,
      },
      assetMetrics: [],
    };
  }
}; 