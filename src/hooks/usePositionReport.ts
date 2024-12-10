import { Address } from 'viem';
import { calculateEarningsFromSnapshot, filterTransactionsInPeriod } from '@/utils/interest';
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
  periodInDays: number;
  marketReports: PositionReport[];
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
      endDate = new Date(Date.now());
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
    const periodInDays = (endTimestamp - startTimestamp) / (24 * 60 * 60);

    const relevantPositions = positions.filter(
      (position) =>
        position.market.loanAsset.address.toLowerCase() === selectedAsset.address.toLowerCase() &&
        position.market.morphoBlue.chain.id === selectedAsset.chainId,
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
            return null;
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
    ).filter((report) => report !== null) as PositionReport[];

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

    return {
      totalInterestEarned,
      totalDeposits,
      totalWithdraws,
      periodInDays,
      marketReports,
    };
  };

  return { generateReport };
};
