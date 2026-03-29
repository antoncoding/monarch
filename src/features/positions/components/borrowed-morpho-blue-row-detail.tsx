'use client';

import { useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PulseLoader } from 'react-spinners';
import { RateFormatted } from '@/components/shared/rate-formatted';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Tooltip } from '@/components/ui/tooltip';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import {
  computeLiquidationOraclePrice,
  computeLtv,
  computeOraclePriceChangePercent,
  formatLtvPercent,
  formatMarketOraclePriceWithSymbol,
  formatRelativeLiquidationPriceMove,
  getLTVColor,
  getLTVProgressColor,
  isInfiniteLtv,
} from '@/modals/borrow/components/helpers';
import { getMarketIdentityKey } from '@/utils/market-identity';
import type { BorrowPositionRow } from '@/utils/positions';

type BorrowedMorphoBlueRowDetailProps = {
  row: BorrowPositionRow;
};

type BorrowPositionMetrics = {
  currentLtvLabel: string | null;
  displayLtv: bigint | null;
  liquidationOraclePrice: bigint | null;
  lltv: bigint;
  lltvLabel: string;
  ltvWidth: number;
  oraclePrice: bigint;
};

type MetricRowProps = {
  label: string;
  value: ReactNode;
  tooltipTitle?: ReactNode;
  tooltipDetail?: ReactNode;
  tooltipSecondaryDetail?: ReactNode;
  valueClassName?: string;
};

function formatBorrowPositionPrice(row: BorrowPositionRow, oraclePrice: bigint): string {
  return formatMarketOraclePriceWithSymbol({
    oraclePrice,
    collateralDecimals: row.market.collateralAsset.decimals,
    loanDecimals: row.market.loanAsset.decimals,
    loanSymbol: row.market.loanAsset.symbol,
  });
}

export function deriveBorrowPositionMetrics(row: BorrowPositionRow): BorrowPositionMetrics {
  const borrowAssets = BigInt(row.state.borrowAssets);
  const collateralAssets = BigInt(row.state.collateral);
  const oraclePrice = row.oraclePrice ? BigInt(row.oraclePrice) : 0n;
  const lltv = BigInt(row.market.lltv);
  const currentLtv =
    row.isActiveDebt && oraclePrice > 0n
      ? computeLtv({
          borrowAssets,
          collateralAssets,
          oraclePrice,
        })
      : null;
  const displayLtv = currentLtv == null || isInfiniteLtv(currentLtv) ? null : currentLtv;
  const liquidationOraclePrice =
    displayLtv == null
      ? null
      : computeLiquidationOraclePrice({
          oraclePrice,
          ltv: displayLtv,
          lltv,
        });
  const currentLtvLabel = displayLtv == null ? null : `${formatLtvPercent(displayLtv)}%`;
  const lltvLabel = `${formatLtvPercent(lltv)}%`;
  const ltvWidth = displayLtv == null || lltv <= 0n ? 0 : Math.min(100, (Number(displayLtv) / Number(lltv)) * 100);

  return {
    currentLtvLabel,
    displayLtv,
    liquidationOraclePrice,
    lltv,
    lltvLabel,
    ltvWidth,
    oraclePrice,
  };
}

function MetricRow({
  label,
  value,
  tooltipTitle,
  tooltipDetail,
  tooltipSecondaryDetail,
  valueClassName = 'font-zen text-sm tabular-nums text-right',
}: MetricRowProps) {
  const labelNode =
    tooltipTitle || tooltipDetail || tooltipSecondaryDetail ? (
      <Tooltip
        content={
          <TooltipContent
            title={tooltipTitle}
            detail={tooltipDetail}
            secondaryDetail={tooltipSecondaryDetail}
          />
        }
      >
        <span className="cursor-help border-b border-dotted border-white/40">{label}</span>
      </Tooltip>
    ) : (
      label
    );

  return (
    <div className="mb-1 flex items-start justify-between gap-4">
      <p className="font-zen text-sm opacity-50">{labelNode}</p>
      <div className={valueClassName}>{value}</div>
    </div>
  );
}

function renderHistoricalRateValue(value: number | null | undefined, isRateEnrichmentLoading: boolean): ReactNode {
  if (value != null) {
    return <RateFormatted value={value} />;
  }

  if (isRateEnrichmentLoading) {
    return (
      <PulseLoader
        size={4}
        color="#f45f2d"
        margin={3}
      />
    );
  }

  return '—';
}

export function BorrowedMorphoBlueRowDetail({ row }: BorrowedMorphoBlueRowDetailProps) {
  const { allMarkets, isRateEnrichmentLoading } = useProcessedMarkets();
  const marketIdentityKey = useMemo(
    () => getMarketIdentityKey(row.market.morphoBlue.chain.id, row.market.uniqueKey),
    [row.market.morphoBlue.chain.id, row.market.uniqueKey],
  );
  const liveMarket = useMemo(
    () => allMarkets.find((market) => getMarketIdentityKey(market.morphoBlue.chain.id, market.uniqueKey) === marketIdentityKey),
    [allMarkets, marketIdentityKey],
  );
  const resolvedRow = useMemo(
    () =>
      liveMarket
        ? {
            ...row,
            market: liveMarket,
          }
        : row,
    [liveMarket, row],
  );

  const { currentLtvLabel, displayLtv, liquidationOraclePrice, lltv, lltvLabel, ltvWidth, oraclePrice } =
    deriveBorrowPositionMetrics(resolvedRow);
  const currentPrice = formatBorrowPositionPrice(resolvedRow, oraclePrice);
  const liquidationPrice = liquidationOraclePrice == null ? '—' : formatBorrowPositionPrice(resolvedRow, liquidationOraclePrice);
  const priceMove =
    liquidationOraclePrice == null
      ? null
      : computeOraclePriceChangePercent({
          currentOraclePrice: oraclePrice,
          targetOraclePrice: liquidationOraclePrice,
        });
  const ltvValueClassName =
    displayLtv == null
      ? 'font-zen text-sm tabular-nums text-right'
      : `font-zen text-sm tabular-nums text-right ${getLTVColor(displayLtv, lltv)}`;
  const ltvBarClassName = displayLtv == null ? 'bg-gray-500/50' : getLTVProgressColor(displayLtv, lltv);
  const liquidationTooltip =
    liquidationPrice === '—' ? null : (
      <TooltipContent
        title="Liquidation Price"
        detail={
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-secondary">Current Price</span>
              <span className="tabular-nums">{currentPrice}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-secondary">Liquidation Price</span>
              <span className="tabular-nums">{liquidationPrice}</span>
            </div>
          </div>
        }
        secondaryDetail={
          priceMove == null ? undefined : `Relative to current: ${formatRelativeLiquidationPriceMove({ percentChange: priceMove })}`
        }
      />
    );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-4 py-4">
        <div className="grid gap-6 lg:grid-cols-3">
          <section>
            <p className="mb-3 font-monospace text-[10px] uppercase tracking-[0.14em] text-secondary">Borrow Rates</p>
            <MetricRow
              label="1 Day"
              value={renderHistoricalRateValue(resolvedRow.market.state.dailyBorrowApy, isRateEnrichmentLoading)}
            />
            <MetricRow
              label="7 Days"
              value={renderHistoricalRateValue(resolvedRow.market.state.weeklyBorrowApy, isRateEnrichmentLoading)}
            />
          </section>

          <section>
            <p className="mb-3 font-monospace text-[10px] uppercase tracking-[0.14em] text-secondary">Prices</p>
            <MetricRow
              label="Current Price"
              value={currentPrice}
            />
            <MetricRow
              label="Liquidation Price"
              value={
                liquidationTooltip ? (
                  <Tooltip content={liquidationTooltip}>
                    <span className="cursor-help border-b border-dotted border-white/40">{liquidationPrice}</span>
                  </Tooltip>
                ) : (
                  liquidationPrice
                )
              }
            />
            <MetricRow
              label="Price Move"
              tooltipTitle="Price Move"
              tooltipDetail="Relative move from the current oracle price to liquidation."
              value={formatRelativeLiquidationPriceMove({ percentChange: priceMove })}
            />
          </section>

          <section>
            <p className="mb-3 font-monospace text-[10px] uppercase tracking-[0.14em] text-secondary">Risk</p>
            <MetricRow
              label="Loan to Value (LTV)"
              tooltipTitle="Loan to Value (LTV)"
              tooltipDetail="Borrow divided by collateral value."
              tooltipSecondaryDetail={`Liquidation starts at ${lltvLabel}.`}
              value={
                currentLtvLabel == null ? (
                  '—'
                ) : (
                  <span>
                    <span>{currentLtvLabel}</span>
                    <span className="ml-1 text-xs text-secondary">/ {lltvLabel}</span>
                  </span>
                )
              }
              valueClassName={ltvValueClassName}
            />
            <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className={`h-2 rounded-full transition-all duration-500 ease-in-out ${ltvBarClassName}`}
                style={{ width: `${ltvWidth}%` }}
              />
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
