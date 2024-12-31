import { useCallback } from 'react';
import { Token } from '@/utils/tokens';
import { estimatedBlockNumber } from '@/utils/rpc';
import { Market, MarketPosition } from '@/utils/types';
import { usePositionSnapshot } from './usePositionSnapshot';
import { useMarkets } from './useMarkets';
import useUserTransactions from './useUserTransactions';

export type PositionReport = {
  market: Market;
  position: MarketPosition;
  earnings: {
    total: number;
    startTimestamp: number;
    endTimestamp: number;
    startPosition: MarketPosition;
    endPosition: MarketPosition;
  };
};

export type ReportSummary = {
  positions: PositionReport[];
  totalEarnings: number;
  startTimestamp: number;
  endTimestamp: number;
};

export const usePositionReport = (
  account: string | undefined,
  selectedAsset: Token | undefined,
  startDate?: Date,
  endDate?: Date,
) => {
  const { fetchPositionSnapshot } = usePositionSnapshot();
  const { markets } = useMarkets();
  const { fetchTransactions } = useUserTransactions();

  const generateReport = async (): Promise<ReportSummary | null> => {
    if (!startDate || !endDate || !selectedAsset) return null;

    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    // Get block numbers for the timestamps
    const [startBlock, endBlock] = await Promise.all([
      estimatedBlockNumber(startTimestamp),
      estimatedBlockNumber(endTimestamp),
    ]);

    // Get position snapshots
    const [startSnapshot, endSnapshot] = await Promise.all([
      fetchPositionSnapshot(account || '', startBlock),
      fetchPositionSnapshot(account || '', endBlock),
    ]);

    if (!startSnapshot || !endSnapshot) {
      throw new Error('Failed to fetch position snapshots');
    }

    // Get all transactions within the time range
    const result = await fetchTransactions({
      userAddress: [account || ''],
      timestampGte: startTimestamp,
      timestampLte: endTimestamp,
    });

    if (!result) {
      throw new Error('Failed to fetch transactions');
    }

    const relevantTxs = result.items.filter((tx) => {
      const market = markets.find((m) => m.uniqueKey === tx.data?.market?.uniqueKey);
      if (!market) return false;
      return market.loanAsset.address.toLowerCase() === selectedAsset.address.toLowerCase();
    });

    const marketReports = (
      await Promise.all(
        markets
          .filter((market) => market.loanAsset.address === selectedAsset.address)
          .map(async (market) => {
            const startPosition = startSnapshot.find(
              (pos) => pos.market.uniqueKey === market.uniqueKey,
            );
            const endPosition = endSnapshot.find((pos) => pos.market.uniqueKey === market.uniqueKey);

            if (!startPosition || !endPosition) return null;

            const earnings = calculateEarnings(startPosition, endPosition);

            return {
              market,
              position: endPosition,
              earnings: {
                total: earnings,
                startTimestamp,
                endTimestamp,
                startPosition,
                endPosition,
              },
            };
          }),
      )
    ).filter((report): report is PositionReport => report !== null);

    const totalEarnings = marketReports.reduce((sum, report) => sum + report.earnings.total, 0);

    return {
      positions: marketReports,
      totalEarnings,
      startTimestamp,
      endTimestamp,
    };
  };

  return {
    generateReport: useCallback(generateReport, [
      account,
      selectedAsset,
      startDate,
      endDate,
      fetchPositionSnapshot,
      fetchTransactions,
      markets,
    ]),
  };
};

function calculateEarnings(startPosition: MarketPosition, endPosition: MarketPosition): number {
  return 0; // TODO: Implement earnings calculation
}
