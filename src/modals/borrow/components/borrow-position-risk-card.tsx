import { useMemo } from 'react';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatBalance } from '@/utils/balance';
import type { Market } from '@/utils/types';
import { formatLtvPercent, getLTVColor, getLTVProgressColor } from './helpers';

type BorrowPositionRiskCardProps = {
  market: Market;
  currentCollateral: bigint;
  currentBorrow: bigint;
  currentLtv: bigint;
  projectedLtv: bigint;
  lltv: bigint;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  borrowLabel?: string;
  hasChanges?: boolean;
};

export function BorrowPositionRiskCard({
  market,
  currentCollateral,
  currentBorrow,
  currentLtv,
  projectedLtv,
  lltv,
  onRefresh,
  isRefreshing = false,
  borrowLabel = 'Total Borrowed',
  hasChanges = false,
}: BorrowPositionRiskCardProps): JSX.Element {
  const projectedLtvWidth = useMemo(() => {
    if (lltv <= 0n) return 0;
    return Math.min(100, (Number(projectedLtv) / Number(lltv)) * 100);
  }, [projectedLtv, lltv]);

  return (
    <div className="bg-hovered mb-5 rounded-sm p-4">
      <div className="mb-3 flex items-center justify-between font-zen text-base">
        <span>My Borrow</span>
        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-full p-1 transition-opacity hover:opacity-70"
            disabled={isRefreshing}
            aria-label="Refresh position data"
          >
            <RefetchIcon
              isLoading={isRefreshing}
              className="h-4 w-4"
            />
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 font-zen text-xs opacity-50">Total Collateral</p>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.collateralAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.collateralAsset.symbol}
              width={16}
              height={16}
            />
            <p className="font-zen text-sm">
              {formatBalance(currentCollateral, market.collateralAsset.decimals)} {market.collateralAsset.symbol}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-1 font-zen text-xs opacity-50">{borrowLabel}</p>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
            <p className="font-zen text-sm">
              {formatBalance(currentBorrow, market.loanAsset.decimals)} {market.loanAsset.symbol}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="font-zen text-sm opacity-50">Loan to Value (LTV)</p>
          <div className="font-zen text-sm">
            {hasChanges ? (
              <>
                <span className="text-gray-400 line-through">{formatLtvPercent(currentLtv)}%</span>
                <span className={`ml-2 ${getLTVColor(projectedLtv, lltv)}`}>{formatLtvPercent(projectedLtv)}%</span>
              </>
            ) : (
              <span className={getLTVColor(projectedLtv, lltv)}>{formatLtvPercent(projectedLtv)}%</span>
            )}
          </div>
        </div>

        <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={`h-2 rounded-full transition-all duration-500 ease-in-out ${getLTVProgressColor(projectedLtv, lltv)}`}
            style={{ width: `${projectedLtvWidth}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-end text-xs">
          <p className="text-secondary">Max LTV: {formatLtvPercent(lltv)}%</p>
        </div>
      </div>
    </div>
  );
}
