import { Market, MarketPosition, UserTransaction } from '@/utils/types';
import { usePositionSnapshot } from './usePositionSnapshot';
import { Address } from 'viem';
import { calculateEarningsFromSnapshot, filterTransactionsInPeriod } from '@/utils/interest';

export type PositionReport = {
  market: Market;
  interestEarned: string;
  totalDeposits: string;
  totalWithdraws: string;
  startBalance: string;
  endBalance: string;
  transactions: UserTransaction[];
};

export type ReportSummary = {
  totalInterestEarned: string;
  totalDeposits: string;
  totalWithdraws: string;
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
      endDate = new Date(Date.now());
    }

    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    const periodInDays = (endTimestamp - startTimestamp) / (24 * 60 * 60);

    const relevantPositions = positions.filter(
      (position) =>
        position.market.loanAsset.address.toLowerCase() === selectedAsset.address.toLowerCase() &&
        position.market.morphoBlue.chain.id === selectedAsset.chainId,
    );

    const marketReports = (await Promise.all(
      relevantPositions.map(async (position) => {
        const startSnapshot = await fetchPositionSnapshot(
          position.market.uniqueKey,
          account,
          position.market.morphoBlue.chain.id,
          startTimestamp,
        );
        const endSnapshot = await fetchPositionSnapshot(
          position.market.uniqueKey,
          account,
          position.market.morphoBlue.chain.id,
          endTimestamp,
        );

        if (!startSnapshot || !endSnapshot) {
          return null;
        }

        const marketTransactions = filterTransactionsInPeriod(
          history.filter((tx) => tx.data?.market?.uniqueKey === position.market.uniqueKey),
          startTimestamp,
          endTimestamp,
        );

        // Skip markets with no transactions in the period
        if (marketTransactions.length === 0) {
          return null;
        }

        const earnings = calculateEarningsFromSnapshot(
          BigInt(endSnapshot.supplyAssets),
          BigInt(startSnapshot.supplyAssets),
          marketTransactions,
          startTimestamp,
          endTimestamp,
        );

        return {
          market: position.market,
          interestEarned: earnings.earned.toString(),
          totalDeposits: earnings.totalDeposits.toString(),
          totalWithdraws: earnings.totalWithdraws.toString(),
          startBalance: startSnapshot.supplyAssets,
          endBalance: endSnapshot.supplyAssets,
          transactions: marketTransactions,
        };
      }),
    )).filter((report): report is PositionReport => report !== null);

    const totalInterestEarned = marketReports
      .reduce((sum, report) => sum + BigInt(report.interestEarned), 0n)
      .toString();

    const totalDeposits = marketReports
      .reduce((sum, report) => sum + BigInt(report.totalDeposits), 0n)
      .toString();

    const totalWithdraws = marketReports
      .reduce((sum, report) => sum + BigInt(report.totalWithdraws), 0n)
      .toString();

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
