import { type ReactNode, useMemo } from 'react';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatBalance } from '@/utils/balance';
import { formatCompactTokenAmount, formatFullTokenAmount } from '@/utils/token-amount-format';
import type { Market } from '@/utils/types';
import { formatLtvPercent, getLTVColor, getLTVProgressColor } from './helpers';

type BorrowPositionRiskCardProps = {
  market: Market;
  currentCollateral: bigint;
  currentBorrow: bigint;
  projectedCollateral?: bigint;
  projectedBorrow?: bigint;
  currentLtv: bigint;
  projectedLtv: bigint;
  lltv: bigint;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  hasChanges?: boolean;
  useCompactAmountDisplay?: boolean;
};

function renderAmountValue(value: bigint, decimals: number, useCompactAmountDisplay: boolean): ReactNode {
  if (!useCompactAmountDisplay) {
    return formatBalance(value, decimals);
  }

  const compactValue = formatCompactTokenAmount(value, decimals);
  const fullValue = formatFullTokenAmount(value, decimals);

  return (
    <Tooltip content={<span className="font-monospace text-xs">{fullValue}</span>}>
      <span className="cursor-help border-b border-dotted border-white/40">{compactValue}</span>
    </Tooltip>
  );
}

export function BorrowPositionRiskCard({
  market,
  currentCollateral,
  currentBorrow,
  projectedCollateral,
  projectedBorrow,
  currentLtv,
  projectedLtv,
  lltv,
  onRefresh,
  isRefreshing = false,
  hasChanges = false,
  useCompactAmountDisplay = false,
}: BorrowPositionRiskCardProps): JSX.Element {
  const projectedLtvWidth = useMemo(() => {
    if (lltv <= 0n) return 0;
    return Math.min(100, (Number(projectedLtv) / Number(lltv)) * 100);
  }, [projectedLtv, lltv]);

  const projectedCollateralValue = projectedCollateral ?? currentCollateral;
  const projectedBorrowValue = projectedBorrow ?? currentBorrow;

  const showProjectedCollateral = hasChanges && projectedCollateralValue !== currentCollateral;
  const showProjectedBorrow = hasChanges && projectedBorrowValue !== currentBorrow;

  return (
    <div className="bg-hovered mb-5 rounded-sm p-4">
      <div className={`mb-4 grid items-start gap-4 ${onRefresh ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : 'grid-cols-2'}`}>
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
              {showProjectedCollateral ? (
                <>
                  <span className="text-gray-400 line-through">
                    {renderAmountValue(currentCollateral, market.collateralAsset.decimals, useCompactAmountDisplay)}
                  </span>
                  <span className="ml-2">
                    {renderAmountValue(projectedCollateralValue, market.collateralAsset.decimals, useCompactAmountDisplay)}
                  </span>
                </>
              ) : (
                renderAmountValue(projectedCollateralValue, market.collateralAsset.decimals, useCompactAmountDisplay)
              )}{' '}
              {market.collateralAsset.symbol}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-1 font-zen text-xs opacity-50">Debt</p>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
            <p className="font-zen text-sm">
              {showProjectedBorrow ? (
                <>
                  <span className="text-gray-400 line-through">
                    {renderAmountValue(currentBorrow, market.loanAsset.decimals, useCompactAmountDisplay)}
                  </span>
                  <span className="ml-2">
                    {renderAmountValue(projectedBorrowValue, market.loanAsset.decimals, useCompactAmountDisplay)}
                  </span>
                </>
              ) : (
                renderAmountValue(projectedBorrowValue, market.loanAsset.decimals, useCompactAmountDisplay)
              )}{' '}
              {market.loanAsset.symbol}
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="self-start rounded-full p-1 transition-opacity hover:opacity-70"
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
