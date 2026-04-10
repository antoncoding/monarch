import { useMemo, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatBalance } from '@/utils/balance';
import { formatCompactTokenAmount, formatFullTokenAmount } from '@/utils/token-amount-format';
import type { Market } from '@/utils/types';
import {
  computeHealthScoreFromLtv,
  computeLiquidationOraclePrice,
  computeOraclePriceChangePercent,
  formatHealthScore,
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
  hasChanges?: boolean;
  useCompactAmountDisplay?: boolean;
};

type PreviewIndicatorProps = {
  isPreview: boolean;
  title: ReactNode;
  detail: ReactNode;
  secondaryDetail?: ReactNode;
  children: ReactNode;
};

type TokenMetricValueProps = {
  isPreview: boolean;
  title: ReactNode;
  detail: ReactNode;
  secondaryDetail?: ReactNode;
  displayAmount: string;
  fullAmount: string;
  symbol: string;
  valueClassName: string;
};

const INLINE_VALUE_TOOLTIP_CLASS_NAME = 'px-4 py-3 text-xs';

function formatSignedNumberDelta(value: number, suffix = ''): string {
  if (!Number.isFinite(value)) return '0';
  if (value > 0) return `+${value.toFixed(2)}${suffix}`;
  if (value < 0) return `-${Math.abs(value).toFixed(2)}${suffix}`;
  return `0.00${suffix}`;
}

function formatSignedTokenDelta(value: bigint, decimals: number): string {
  if (value > 0n) return `+${formatBalance(value, decimals)}`;
  if (value < 0n) return `-${formatBalance(-value, decimals)}`;
  return '0';
}

function formatTokenAmountForDisplay(value: bigint, decimals: number, useCompactAmountDisplay: boolean): string {
  return useCompactAmountDisplay ? formatCompactTokenAmount(value, decimals) : String(formatBalance(value, decimals));
}

function formatTokenAmountForTooltip(value: bigint, decimals: number, useCompactAmountDisplay: boolean): string {
  return useCompactAmountDisplay ? formatFullTokenAmount(value, decimals) : String(formatBalance(value, decimals));
}

function PreviewIndicator({ isPreview, title, detail, secondaryDetail, children }: PreviewIndicatorProps): JSX.Element {
  if (!isPreview) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      content={
        <TooltipContent
          title={title}
          detail={detail}
          secondaryDetail={secondaryDetail}
        />
      }
    >
      <span className="inline-flex min-w-0 cursor-help items-center border-b border-dotted border-secondary/70 pb-px">{children}</span>
    </Tooltip>
  );
}

function TokenMetricValue({
  isPreview,
  title,
  detail,
  secondaryDetail,
  displayAmount,
  fullAmount,
  symbol,
  valueClassName,
}: TokenMetricValueProps): JSX.Element {
  const content = (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <span className={`${valueClassName} shrink-0`}>{displayAmount}</span>
      <span className={`${valueClassName} shrink-0`}>{symbol}</span>
    </div>
  );

  if (isPreview) {
    return (
      <PreviewIndicator
        isPreview={isPreview}
        title={title}
        detail={detail}
        secondaryDetail={secondaryDetail}
      >
        {content}
      </PreviewIndicator>
    );
  }

  if (displayAmount === fullAmount) {
    return content;
  }

  return (
    <Tooltip
      content={`${fullAmount} ${symbol}`}
      className={INLINE_VALUE_TOOLTIP_CLASS_NAME}
    >
      <span className="inline-flex min-w-0 cursor-help items-center border-b border-dotted border-secondary/70 pb-px">{content}</span>
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
  hasChanges = false,
  useCompactAmountDisplay = true,
}: BorrowPositionRiskCardProps): JSX.Element {
  const projectedLtvWidth = useMemo(() => {
    if (lltv <= 0n) return 0;
    return Math.min(100, (Number(projectedLtv) / Number(lltv)) * 100);
  }, [projectedLtv, lltv]);

  const projectedCollateralValue = projectedCollateral ?? currentCollateral;
  const projectedBorrowValue = projectedBorrow ?? currentBorrow;
  const metricLabelClassName = 'mb-1 font-zen text-xs opacity-50';
  const metricValueClassName = 'font-zen text-sm tabular-nums';

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

  const formatPriceLabel = (value: string): string => (value === '-' || value === '∞' ? value : `${value} ${market.loanAsset.symbol}`);
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

  const currentHealthScore = computeHealthScoreFromLtv({ ltv: currentLtv, lltv });
  const projectedHealthScore = computeHealthScoreFromLtv({ ltv: projectedLtv, lltv });
  const currentHealthScoreLabel = formatHealthScore(currentHealthScore, 2);
  const projectedHealthScoreLabel = formatHealthScore(projectedHealthScore, 2);
  const showProjectedHealthScore = hasChanges && currentHealthScoreLabel !== projectedHealthScoreLabel;

  const collateralDisplay = formatTokenAmountForDisplay(projectedCollateralValue, market.collateralAsset.decimals, useCompactAmountDisplay);
  const collateralCurrentDetail = formatTokenAmountForTooltip(currentCollateral, market.collateralAsset.decimals, useCompactAmountDisplay);
  const collateralProjectedDetail = formatTokenAmountForTooltip(
    projectedCollateralValue,
    market.collateralAsset.decimals,
    useCompactAmountDisplay,
  );
  const collateralDeltaLabel = formatSignedTokenDelta(projectedCollateralValue - currentCollateral, market.collateralAsset.decimals);

  const borrowDisplay = formatTokenAmountForDisplay(projectedBorrowValue, market.loanAsset.decimals, useCompactAmountDisplay);
  const borrowCurrentDetail = formatTokenAmountForTooltip(currentBorrow, market.loanAsset.decimals, useCompactAmountDisplay);
  const borrowProjectedDetail = formatTokenAmountForTooltip(projectedBorrowValue, market.loanAsset.decimals, useCompactAmountDisplay);
  const borrowDeltaLabel = formatSignedTokenDelta(projectedBorrowValue - currentBorrow, market.loanAsset.decimals);

  const projectedLtvLabel = `${formatLtvPercent(projectedLtv)}%`;
  const currentLtvLabel = `${formatLtvPercent(currentLtv)}%`;
  const ltvDelta = (Number(projectedLtv) - Number(currentLtv)) / 1e16;

  return (
    <div className="bg-hovered mb-5 rounded-sm p-4">
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="min-w-0">
          <p className={metricLabelClassName}>Collateral</p>
          <div className="flex min-w-0 items-center gap-2">
            <TokenIcon
              address={market.collateralAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.collateralAsset.symbol}
              width={16}
              height={16}
            />
            <TokenMetricValue
              isPreview={showProjectedCollateral}
              title="Collateral Preview"
              detail={`${collateralCurrentDetail} → ${collateralProjectedDetail} ${market.collateralAsset.symbol}`}
              secondaryDetail={`Delta: ${collateralDeltaLabel} ${market.collateralAsset.symbol}`}
              displayAmount={collateralDisplay}
              fullAmount={collateralProjectedDetail}
              symbol={market.collateralAsset.symbol}
              valueClassName={metricValueClassName}
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className={metricLabelClassName}>Debt (Loan)</p>
          <div className="flex min-w-0 items-center gap-2">
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
            <TokenMetricValue
              isPreview={showProjectedBorrow}
              title="Debt (Loan) Preview"
              detail={`${borrowCurrentDetail} → ${borrowProjectedDetail} ${market.loanAsset.symbol}`}
              secondaryDetail={`Delta: ${borrowDeltaLabel} ${market.loanAsset.symbol}`}
              displayAmount={borrowDisplay}
              fullAmount={borrowProjectedDetail}
              symbol={market.loanAsset.symbol}
              valueClassName={metricValueClassName}
            />
          </div>
        </div>

        <div className="md:justify-self-end md:text-right">
          <p className={metricLabelClassName}>Health Score</p>
          <PreviewIndicator
            isPreview={showProjectedHealthScore}
            title="Health Score Preview"
            detail={`${currentHealthScoreLabel} → ${projectedHealthScoreLabel}`}
            secondaryDetail={`Delta: ${formatSignedNumberDelta((projectedHealthScore ?? 0) - (currentHealthScore ?? 0))}`}
          >
            <span className={metricValueClassName}>{projectedHealthScoreLabel}</span>
          </PreviewIndicator>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-zen text-sm opacity-50">Loan to Value (LTV)</p>
            <div className={`${metricValueClassName} text-right`}>
              <PreviewIndicator
                isPreview={showProjectedLtv}
                title="LTV Preview"
                detail={`${currentLtvLabel} → ${projectedLtvLabel}`}
                secondaryDetail={`Delta: ${formatSignedNumberDelta(ltvDelta, ' pp')}`}
              >
                <span className={getLTVColor(projectedLtv, lltv)}>{projectedLtvLabel}</span>
              </PreviewIndicator>
              <span className="ml-1 text-xs text-secondary">/ {formatLtvPercent(lltv)}%</span>
            </div>
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
            <Tooltip
              content={
                <TooltipContent
                  title="Liquidation Price Preview"
                  detail={
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-secondary">Current Price</span>
                        <span className="tabular-nums">{formatPriceLabel(currentPriceDisplay)}</span>
                      </div>
                      {showProjectedLiquidationPrice && currentLiquidationPriceDisplay !== '-' && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-secondary">Previous Liquidation Price</span>
                          <span className="tabular-nums">{currentLiquidationPriceValue}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-secondary">Preview Liquidation Price</span>
                        <span className="tabular-nums">{projectedLiquidationPriceValue}</span>
                      </div>
                    </div>
                  }
                  secondaryDetail={
                    projectedLiquidationPriceChangePercent == null
                      ? undefined
                      : `Relative to current oracle: ${formatPriceGapFromCurrent(projectedLiquidationPriceChangePercent)}`
                  }
                />
              }
            >
              <span
                className={`${metricValueClassName} text-right ${showProjectedLiquidationPrice ? 'cursor-help border-b border-dotted border-white/40' : ''}`}
              >
                {projectedLiquidationPriceValue}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
