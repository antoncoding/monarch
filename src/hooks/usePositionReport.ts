import { MarketPosition, UserTransaction } from '@/utils/types';
import { usePositionSnapshot } from './usePositionSnapshot';
import { Address } from 'viem';
import { calculateEarningsFromSnapshot } from '@/utils/interest';

export type PositionReport = {
  marketId: string;
  symbol: string;
  chainId: number;
  interestEarned: string;
  startBalance: string;
  endBalance: string;
  transactions: UserTransaction[];
};

export type ReportSummary = {
  totalInterestEarned: string;
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

    console.log('generateReport', {
      positions,
      history,
      account,
      selectedAsset,
      startDate,
      endDate,
    })

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

    console.log('relevantPositions', relevantPositions)

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

        const marketTransactions = history.filter(
          (tx) =>
            tx.data?.market?.uniqueKey === position.market.uniqueKey &&
            Number(tx.timestamp) >= startTimestamp &&
            Number(tx.timestamp) <= endTimestamp,
        );

        console.log('marketTransactions', marketTransactions)

        const interestEarned = calculateEarningsFromSnapshot(
          BigInt(endSnapshot.supplyAssets),
          BigInt(startSnapshot.supplyAssets),
          marketTransactions,
          startTimestamp,
          endTimestamp,
        );

        console.log('interestEarned', interestEarned)

        return {
          marketId: position.market.id,
          symbol: position.market.loanAsset.symbol,
          chainId: position.market.morphoBlue.chain.id,
          interestEarned,
          startBalance: startSnapshot.supplyAssets,
          endBalance: endSnapshot.supplyAssets,
          transactions: marketTransactions,
        };
      }),
    )).filter((report): report is PositionReport => report !== null);

    const totalInterestEarned = marketReports
      .reduce((sum, report) => sum + BigInt(report.interestEarned), 0n)
      .toString();

    return {
      totalInterestEarned,
      periodInDays,
      marketReports,
    };
  };

  return { generateReport };
};
