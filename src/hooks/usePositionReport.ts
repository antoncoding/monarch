import type { Address } from 'viem';
import { calculateEarningsFromSnapshot, type EarningsCalculation, filterTransactionsInPeriod } from '@/utils/interest';
import type { SupportedNetworks } from '@/utils/networks';
import { fetchPositionsSnapshots } from '@/utils/positions';
import { getClient } from '@/utils/rpc';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { Market, MarketPosition, UserTransaction } from '@/utils/types';
import { useCustomRpc } from '@/stores/useCustomRpc';
import { fetchUserTransactions } from './queries/fetchUserTransactions';

export type PositionReport = {
  market: Market;
  interestEarned: bigint;
  totalDeposits: bigint;
  totalWithdraws: bigint;
  startBalance: bigint;
  endBalance: bigint;
  avgCapital: bigint;
  apy: number;
  effectiveTime: number;
  transactions: UserTransaction[];
};

export type ReportSummary = {
  totalInterestEarned: bigint;
  totalDeposits: bigint;
  totalWithdraws: bigint;
  period: number;
  marketReports: PositionReport[];
  groupedEarnings: EarningsCalculation;
  startBlock: number;
  endBlock: number;
  startTimestamp: number;
  endTimestamp: number;
};

export const usePositionReport = (
  positions: MarketPosition[],
  account: Address,
  selectedAsset: { address: string; chainId: number } | null,
  startDate?: Date,
  _endDate?: Date,
) => {
  const { customRpcUrls } = useCustomRpc();

  const generateReport = async (): Promise<ReportSummary | null> => {
    let endDate = _endDate;

    if (!startDate || !endDate || !selectedAsset) return null;

    if (endDate.getTime() > Date.now()) {
      console.log('setting end date to now');
      endDate = new Date();
    }

    // Get current block number for client-side estimation
    const client = getClient(selectedAsset.chainId as SupportedNetworks, customRpcUrls[selectedAsset.chainId as SupportedNetworks]);
    const currentBlock = Number(await client.getBlockNumber());
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Estimate block numbers (client-side, instant!)
    const targetStartTimestamp = Math.floor(startDate.getTime() / 1000);
    const targetEndTimestamp = Math.floor(endDate.getTime() / 1000);
    const startBlockEstimate = estimateBlockAtTimestamp(selectedAsset.chainId, targetStartTimestamp, currentBlock, currentTimestamp);
    const endBlockEstimate = estimateBlockAtTimestamp(selectedAsset.chainId, targetEndTimestamp, currentBlock, currentTimestamp);

    // Fetch ACTUAL timestamps for the estimated blocks (critical for accuracy)
    const [startBlock, endBlock] = await Promise.all([
      client.getBlock({ blockNumber: BigInt(startBlockEstimate) }),
      client.getBlock({ blockNumber: BigInt(endBlockEstimate) }),
    ]);

    const actualStartTimestamp = Number(startBlock.timestamp);
    const actualEndTimestamp = Number(endBlock.timestamp);
    const period = actualEndTimestamp - actualStartTimestamp;

    // Fetch ALL transactions for this asset with auto-pagination
    // Query by assetId to discover all markets (including closed ones)
    const PAGE_SIZE = 1000; // Larger page size for report generation
    let allTransactions: UserTransaction[] = [];
    let hasMore = true;
    let skip = 0;

    while (hasMore) {
      const transactionResult = await fetchUserTransactions({
        userAddress: [account],
        chainIds: [selectedAsset.chainId],
        timestampGte: actualStartTimestamp,
        timestampLte: actualEndTimestamp,
        assetIds: [selectedAsset.address],
        first: PAGE_SIZE,
        skip,
      });

      if (!transactionResult) {
        throw new Error('Failed to fetch transactions');
      }

      allTransactions = [...allTransactions, ...transactionResult.items];

      // Check if we've fetched all transactions
      hasMore = transactionResult.items.length === PAGE_SIZE;
      skip += PAGE_SIZE;

      // Safety check to prevent infinite loops (50 pages = 50k transactions)
      if (skip > PAGE_SIZE * 50) {
        console.warn('Reached maximum pagination limit (50k transactions), some data might be missing');
        break;
      }
    }

    // Discover unique markets from transactions (includes closed markets)
    const discoveredMarketIds = [...new Set(allTransactions.map((tx) => tx.data?.market?.uniqueKey).filter((id): id is string => !!id))];

    // Filter positions to only those that had activity (some might be closed now)
    const relevantPositions = positions.filter((position) => discoveredMarketIds.includes(position.market.uniqueKey));

    // Fetch start and end snapshots in parallel (batched per block number)
    const [startSnapshots, endSnapshots] = await Promise.all([
      fetchPositionsSnapshots(discoveredMarketIds, account, selectedAsset.chainId, startBlockEstimate, client),
      fetchPositionsSnapshots(discoveredMarketIds, account, selectedAsset.chainId, endBlockEstimate, client),
    ]);

    // Process positions with their snapshots
    const marketReports = relevantPositions
      .map((position) => {
        const marketKey = position.market.uniqueKey;
        const startSnapshot = startSnapshots.get(marketKey);
        const endSnapshot = endSnapshots.get(marketKey);

        if (!startSnapshot || !endSnapshot) {
          return null;
        }

        const marketTransactions = filterTransactionsInPeriod(
          allTransactions.filter((tx) => tx.data?.market?.uniqueKey === marketKey),
          actualStartTimestamp,
          actualEndTimestamp,
        );

        const earnings = calculateEarningsFromSnapshot(
          BigInt(endSnapshot.supplyAssets),
          BigInt(startSnapshot.supplyAssets),
          marketTransactions,
          actualStartTimestamp,
          actualEndTimestamp,
        );

        return {
          market: position.market,
          interestEarned: earnings.earned,
          totalDeposits: earnings.totalDeposits,
          totalWithdraws: earnings.totalWithdraws,
          apy: earnings.apy,
          avgCapital: earnings.avgCapital,
          effectiveTime: earnings.effectiveTime,
          startBalance: BigInt(startSnapshot.supplyAssets),
          endBalance: BigInt(endSnapshot.supplyAssets),
          transactions: marketTransactions,
        };
      })
      .filter((report): report is PositionReport => report !== null);

    const totalInterestEarned = marketReports.reduce((sum, report) => sum + BigInt(report.interestEarned), 0n);

    const totalDeposits = marketReports.reduce((sum, report) => sum + BigInt(report.totalDeposits), 0n);

    const totalWithdraws = marketReports.reduce((sum, report) => sum + BigInt(report.totalWithdraws), 0n);

    const startBalance = marketReports.reduce((sum, report) => sum + BigInt(report.startBalance), 0n);

    const endBalance = marketReports.reduce((sum, report) => sum + BigInt(report.endBalance), 0n);

    const groupedEarnings = calculateEarningsFromSnapshot(
      endBalance,
      startBalance,
      allTransactions,
      actualStartTimestamp,
      actualEndTimestamp,
    );

    return {
      totalInterestEarned,
      totalDeposits,
      totalWithdraws,
      period,
      marketReports,
      groupedEarnings,
      startBlock: startBlockEstimate,
      endBlock: endBlockEstimate,
      startTimestamp: actualStartTimestamp,
      endTimestamp: actualEndTimestamp,
    };
  };

  return { generateReport };
};
