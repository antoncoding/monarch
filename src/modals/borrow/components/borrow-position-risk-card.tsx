import { type ReactNode, useMemo } from 'react';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatBalance } from '@/utils/balance';
import { formatCompactTokenAmount, formatFullTokenAmount } from '@/utils/token-amount-format';
import type { Market } from '@/utils/types';
import {
  computeOraclePriceChangePercent,
  computeLiquidationOraclePrice,
  formatLtvPercent,
  formatMarketOraclePrice,
  getLTVColor,
  getLTVProgressColor,
  isInfiniteLtv,
} from './helpers';

type BorrowPositionRiskCardProps = {
  market: Market;
  oraclePrice: bigint;
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

function renderLiquidationPriceValue(priceLabel: string, priceGapLabel: string | null): ReactNode {
  if (priceGapLabel == null || priceLabel === '-' || priceLabel === '∞') {
    return priceLabel;
  }

  return (
    <>
      <span>{priceLabel}</span>
      <span className="ml-1 text-xs text-secondary">({priceGapLabel})</span>
    </>
  );
}

export function BorrowPositionRiskCard({
  market,
  oraclePrice,
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
  const metricLabelClassName = 'mb-1 font-zen text-xs opacity-50';
  const metricValueClassName = 'font-zen text-sm';

  const showProjectedCollateral = hasChanges && projectedCollateralValue !== currentCollateral;
  const showProjectedBorrow = hasChanges && projectedBorrowValue !== currentBorrow;
  const showProjectedLtv = hasChanges && currentLtv !== projectedLtv;
  const currentPriceDisplay = useMemo(
    () =>
      formatMarketOraclePrice({
        oraclePrice,
        collateralDecimals: market.collateralAsset.decimals,
        loanDecimals: market.loanAsset.decimals,
      }),
    [oraclePrice, market.collateralAsset.decimals, market.loanAsset.decimals],
  );
  const currentLiquidationOraclePrice = useMemo(
    () =>
      currentLtv <= 0n || isInfiniteLtv(currentLtv)
        ? null
        : computeLiquidationOraclePrice({
            oraclePrice,
            ltv: currentLtv,
            lltv,
          }),
    [currentLtv, lltv, oraclePrice],
  );
  const projectedLiquidationOraclePrice = useMemo(
    () =>
      projectedLtv <= 0n || isInfiniteLtv(projectedLtv)
        ? null
        : computeLiquidationOraclePrice({
            oraclePrice,
            ltv: projectedLtv,
            lltv,
          }),
    [projectedLtv, lltv, oraclePrice],
  );

  const currentLiquidationPriceDisplay = useMemo(() => {
    if (currentLtv <= 0n) return '-';
    if (isInfiniteLtv(currentLtv)) return '∞';
    if (currentLiquidationOraclePrice == null) return '-';

    return formatMarketOraclePrice({
      oraclePrice: currentLiquidationOraclePrice,
      collateralDecimals: market.collateralAsset.decimals,
      loanDecimals: market.loanAsset.decimals,
    });
  }, [currentLtv, currentLiquidationOraclePrice, market.collateralAsset.decimals, market.loanAsset.decimals]);

  const projectedLiquidationPriceDisplay = useMemo(() => {
    if (projectedLtv <= 0n) return '-';
    if (isInfiniteLtv(projectedLtv)) return '∞';
    if (projectedLiquidationOraclePrice == null) return '-';

    return formatMarketOraclePrice({
      oraclePrice: projectedLiquidationOraclePrice,
      collateralDecimals: market.collateralAsset.decimals,
      loanDecimals: market.loanAsset.decimals,
    });
  }, [projectedLtv, projectedLiquidationOraclePrice, market.collateralAsset.decimals, market.loanAsset.decimals]);

  const showProjectedLiquidationPrice = hasChanges && currentLiquidationPriceDisplay !== projectedLiquidationPriceDisplay;

  const formatPriceLabel = (value: string): string =>
    value === '-' || value === '∞' ? value : `${value} ${market.loanAsset.symbol}`;
  const formatPercentLabel = (value: number): string => `${value.toFixed(2).replace(/\.?0+$/u, '')}%`;
  const currentLiquidationPriceChangePercent = useMemo(
    () =>
      currentLiquidationOraclePrice == null
        ? null
        : computeOraclePriceChangePercent({
            currentOraclePrice: oraclePrice,
            targetOraclePrice: currentLiquidationOraclePrice,
          }),
    [currentLiquidationOraclePrice, oraclePrice],
  );
  const projectedLiquidationPriceChangePercent = useMemo(
    () =>
      projectedLiquidationOraclePrice == null
        ? null
        : computeOraclePriceChangePercent({
            currentOraclePrice: oraclePrice,
            targetOraclePrice: projectedLiquidationOraclePrice,
          }),
    [projectedLiquidationOraclePrice, oraclePrice],
  );
  const formatPriceGapFromCurrent = (percentChange: number | null): string | null => {
    if (percentChange == null || !Number.isFinite(percentChange)) return null;
    if (percentChange > 0) return `-${formatPercentLabel(percentChange)}`;
    if (percentChange < 0) return `+${formatPercentLabel(Math.abs(percentChange))}`;
    return '0%';
  };
  const currentLiquidationPriceValue = renderLiquidationPriceValue(
    formatPriceLabel(currentLiquidationPriceDisplay),
    formatPriceGapFromCurrent(currentLiquidationPriceChangePercent),
  );
  const projectedLiquidationPriceValue = renderLiquidationPriceValue(
    formatPriceLabel(projectedLiquidationPriceDisplay),
    formatPriceGapFromCurrent(projectedLiquidationPriceChangePercent),
  );
  const liquidationPriceTooltipContent =
    projectedLiquidationPriceDisplay === '-'
      ? null
      : (
          <TooltipContent
            title="Liquidation Price"
            detail={
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-secondary">Current Price</span>
                  <span className="tabular-nums">{formatPriceLabel(currentPriceDisplay)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-secondary">Liquidation Price</span>
                  <span className="tabular-nums">{formatPriceLabel(projectedLiquidationPriceDisplay)}</span>
                </div>
              </div>
            }
            secondaryDetail={
              projectedLiquidationPriceChangePercent == null
                ? undefined
                : `Relative to current: ${formatPriceGapFromCurrent(projectedLiquidationPriceChangePercent)}`
            }
          />
        );

  return (
    <div className="bg-hovered mb-5 rounded-sm p-4">
      <div className={`mb-4 grid items-start gap-4 ${onRefresh ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : 'grid-cols-2'}`}>
        <div>
          <p className={metricLabelClassName}>Total Collateral</p>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.collateralAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.collateralAsset.symbol}
              width={16}
              height={16}
            />
            <p className={metricValueClassName}>
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
          <p className={metricLabelClassName}>Debt</p>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
            <p className={metricValueClassName}>
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

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-zen text-sm opacity-50">Loan to Value (LTV)</p>
            <p className={`${metricValueClassName} text-right tabular-nums`}>
              {showProjectedLtv && <span className="text-gray-400 line-through">{formatLtvPercent(currentLtv)}%</span>}
              <span className={showProjectedLtv ? `ml-2 ${getLTVColor(projectedLtv, lltv)}` : getLTVColor(projectedLtv, lltv)}>
                {formatLtvPercent(projectedLtv)}%
              </span>
              <span className="ml-1 text-xs text-secondary">/ {formatLtvPercent(lltv)}%</span>
            </p>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className={`h-2 rounded-full transition-all duration-500 ease-in-out ${getLTVProgressColor(projectedLtv, lltv)}`}
              style={{ width: `${projectedLtvWidth}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-zen text-sm opacity-50">Liquidation Price</p>
            {liquidationPriceTooltipContent ? (
              <Tooltip content={liquidationPriceTooltipContent}>
                <p className={`${metricValueClassName} cursor-help border-b border-dotted border-white/40 text-right tabular-nums whitespace-nowrap`}>
                  {showProjectedLiquidationPrice && currentLiquidationPriceDisplay !== '-' && (
                    <span className="text-gray-400 line-through">{currentLiquidationPriceValue}</span>
                  )}
                  <span className={showProjectedLiquidationPrice && currentLiquidationPriceDisplay !== '-' ? 'ml-2' : undefined}>
                    {projectedLiquidationPriceValue}
                  </span>
                </p>
              </Tooltip>
            ) : (
              <p className={`${metricValueClassName} text-right tabular-nums whitespace-nowrap`}>{projectedLiquidationPriceValue}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
