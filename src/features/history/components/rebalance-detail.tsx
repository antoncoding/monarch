'use client';

import { formatUnits } from 'viem';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useMarkets } from '@/contexts/MarketsContext';
import { formatReadable } from '@/utils/balance';
import { getTruncatedAssetName } from '@/utils/oracle';
import { getWithdrawals, getSupplies } from '@/utils/transactionGrouping';
import type { GroupedTransaction } from '@/utils/transactionGrouping';
import type { Market } from '@/utils/types';

type RebalanceDetailProps = {
  groupedTransaction: GroupedTransaction;
};

export function RebalanceDetail({ groupedTransaction }: RebalanceDetailProps) {
  const { allMarkets } = useMarkets();

  const withdrawals = getWithdrawals(groupedTransaction.transactions);
  const supplies = getSupplies(groupedTransaction.transactions);

  // Get the loan asset info from the first transaction
  const firstTx = groupedTransaction.transactions[0];
  const firstMarket = allMarkets.find((m) => m.uniqueKey === firstTx.data.market.uniqueKey) as Market | undefined;
  const loanAssetSymbol = firstMarket?.loanAsset.symbol ?? '';
  const loanAssetDecimals = firstMarket?.loanAsset.decimals ?? 18;

  return (
    <div className="bg-surface-soft rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left side - Withdrawals */}
        <div className="space-y-2">
          {withdrawals.map((tx, idx) => {
            const market = allMarkets.find((m) => m.uniqueKey === tx.data.market.uniqueKey) as Market | undefined;

            if (!market) return null;

            return (
              <div
                key={`withdraw-${tx.hash}-${idx}`}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <MarketIdentity
                    market={market}
                    chainId={market.morphoBlue.chain.id}
                    mode={MarketIdentityMode.Focused}
                    focus={MarketIdentityFocus.Collateral}
                    showId={true}
                    showLltv={true}
                    showOracle={false}
                    iconSize={16}
                  />
                </div>
                <div className="text-sm text-red-500 whitespace-nowrap">
                  -{formatReadable(Number(formatUnits(BigInt(tx.data.assets), loanAssetDecimals)))} {getTruncatedAssetName(loanAssetSymbol)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right side - Supplies */}
        <div className="space-y-2">
          {supplies.map((tx, idx) => {
            const market = allMarkets.find((m) => m.uniqueKey === tx.data.market.uniqueKey) as Market | undefined;

            if (!market) return null;

            return (
              <div
                key={`supply-${tx.hash}-${idx}`}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <MarketIdentity
                    market={market}
                    chainId={market.morphoBlue.chain.id}
                    mode={MarketIdentityMode.Focused}
                    focus={MarketIdentityFocus.Collateral}
                    showId={true}
                    showLltv={true}
                    showOracle={false}
                    iconSize={16}
                  />
                </div>
                <div className="text-sm text-green-500 whitespace-nowrap">
                  +{formatReadable(Number(formatUnits(BigInt(tx.data.assets), loanAssetDecimals)))} {getTruncatedAssetName(loanAssetSymbol)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
