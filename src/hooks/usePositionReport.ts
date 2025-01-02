import { Address } from 'viem';
import {
  calculateEarningsFromSnapshot,
  EarningsCalculation,
  filterTransactionsInPeriod,
} from '@/utils/interest';
import { estimatedBlockNumber } from '@/utils/rpc';
import { Market, MarketPosition, UserTransaction } from '@/utils/types';
import { usePositionSnapshot } from './usePositionSnapshot';
import useUserTransactions from './useUserTransactions';

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
};

export const usePositionReport = (
  positions: MarketPosition[],
  account: Address,
  selectedAsset: { address: string; chainId: number } | null,
  startDate?: Date,
  endDate?: Date,
) => {
  const { fetchPositionSnapshot } = usePositionSnapshot();
  const { fetchTransactions } = useUserTransactions();

  const generateReport = async (): Promise<ReportSummary | null> => {
    if (!startDate || !endDate || !selectedAsset) return null;

    if (endDate.getTime() > Date.now()) {
      console.log('setting end date to now');
      endDate = new Date();
    }

    // fetch block number at start and end date
    const { blockNumber: startBlockNumber, timestamp: startTimestamp } = await estimatedBlockNumber(
      selectedAsset.chainId,
      startDate.getTime() / 1000,
    );
    const { blockNumber: endBlockNumber, timestamp: endTimestamp } = await estimatedBlockNumber(
      selectedAsset.chainId,
      endDate.getTime() / 1000,
    );

    const period = endTimestamp - startTimestamp;

    const relevantPositions = positions.filter(
      (position) =>
        position.market.loanAsset.address.toLowerCase() === selectedAsset.address.toLowerCase() &&
        position.market.morphoBlue.chain.id === selectedAsset.chainId,
    );

    // Fetch all transactions with pagination
    const PAGE_SIZE = 100;
    let allTransactions: UserTransaction[] = [];
    let hasMore = true;
    let skip = 0;

    while (hasMore) {
      const transactionResult = await fetchTransactions({
        userAddress: [account],
        chainIds: [selectedAsset.chainId],
        timestampGte: startTimestamp,
        timestampLte: endTimestamp,
        marketUniqueKeys: relevantPositions.map((position) => position.market.uniqueKey),
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

      // Safety check to prevent infinite loops
      if (skip > PAGE_SIZE * 100) {
        console.warn('Reached maximum skip limit, some transactions might be missing');
        break;
      }
    }

    const marketReports = (
      await Promise.all(
        relevantPositions.map(async (position) => {
          const startSnapshot = await fetchPositionSnapshot(
            position.market.uniqueKey,
            account,
            position.market.morphoBlue.chain.id,
            startBlockNumber,
          );
          const endSnapshot = await fetchPositionSnapshot(
            position.market.uniqueKey,
            account,
            position.market.morphoBlue.chain.id,
            endBlockNumber,
          );

          if (!startSnapshot || !endSnapshot) {
            return;
          }

          const marketTransactions = filterTransactionsInPeriod(
            allTransactions.filter(
              (tx) => tx.data?.market?.uniqueKey === position.market.uniqueKey,
            ),
            startTimestamp,
            endTimestamp,
          );

          const earnings = calculateEarningsFromSnapshot(
            BigInt(endSnapshot.supplyAssets),
            BigInt(startSnapshot.supplyAssets),
            marketTransactions,
            startTimestamp,
            endTimestamp,
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
        }),
      )
    ).filter((report) => report !== null && report !== undefined) as PositionReport[];

    const totalInterestEarned = marketReports.reduce(
      (sum, report) => sum + BigInt(report.interestEarned),
      0n,
    );

    const totalDeposits = marketReports.reduce(
      (sum, report) => sum + BigInt(report.totalDeposits),
      0n,
    );

    const totalWithdraws = marketReports.reduce(
      (sum, report) => sum + BigInt(report.totalWithdraws),
      0n,
    );

    const startBalance = marketReports.reduce(
      (sum, report) => sum + BigInt(report.startBalance),
      0n,
    );

    const endBalance = marketReports.reduce((sum, report) => sum + BigInt(report.endBalance), 0n);

    const groupedEarnings = calculateEarningsFromSnapshot(
      endBalance,
      startBalance,
      allTransactions,
      startTimestamp,
      endTimestamp,
    );

    return {
      totalInterestEarned,
      totalDeposits,
      totalWithdraws,
      period,
      marketReports,
      groupedEarnings,
    };
  };

  return { generateReport };
};
