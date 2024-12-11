import { Address } from 'viem';
import {
  calculateEarningsFromSnapshot,
  EarningsCalculation,
  filterTransactionsInPeriod,
} from '@/utils/interest';
import { estimatedBlockNumber } from '@/utils/rpc';
import { Market, MarketPosition, UserTransaction } from '@/utils/types';
import { usePositionSnapshot } from './usePositionSnapshot';

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
  history: UserTransaction[],
  account: Address,
  selectedAsset: { address: string; chainId: number } | null,
  startDate?: Date,
  endDate?: Date,
) => {
  const { fetchPositionSnapshot } = usePositionSnapshot();

  const generateReport = async (): Promise<ReportSummary | null> => {
    if (!startDate || !endDate || !selectedAsset) return null;

    if (endDate.getTime() > Date.now()) {
      console.log('setting end date to now');
      endDate = new Date();
    }

    // fetch block number at start and end date
    const startBlockNumber = await estimatedBlockNumber(
      selectedAsset.chainId,
      startDate.getTime() / 1000,
    );
    const endBlockNumber = await estimatedBlockNumber(
      selectedAsset.chainId,
      endDate.getTime() / 1000,
    );

    let startTimestamp = Math.floor(startDate.getTime() / 1000);
    let endTimestamp = Math.floor(endDate.getTime() / 1000);
    const period = endTimestamp - startTimestamp;

    const relevantPositions = positions.filter(
      (position) =>
        position.market.loanAsset.address.toLowerCase() === selectedAsset.address.toLowerCase() &&
        position.market.morphoBlue.chain.id === selectedAsset.chainId,
    );

    const relevantTxs = history.filter(
      (tx) =>
        tx.data?.market?.loanAsset.address.toLowerCase() === selectedAsset.address.toLowerCase(),
    );

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
            history.filter((tx) => tx.data?.market?.uniqueKey === position.market.uniqueKey),
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
      relevantTxs,
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
