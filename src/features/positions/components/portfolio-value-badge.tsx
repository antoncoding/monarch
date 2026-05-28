import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { TokenIcon } from '@/components/shared/token-icon';
import { type AssetBreakdownItem, formatUsdValue } from '@/utils/portfolio';
import { PulseLoader } from 'react-spinners';

type PortfolioValueBadgeProps = {
  totalUsd: number;
  totalDebtUsd: number;
  assetBreakdown: AssetBreakdownItem[];
  debtBreakdown: AssetBreakdownItem[];
  isLoading: boolean;
  error: Error | null;
  align?: 'start' | 'end';
  className?: string;
  depositInlineMetric?: ReactNode;
};

const VALUE_TEXT_CLASS = 'font-zen text-2xl font-normal leading-none tabular-nums sm:text-2xl';

function formatBalance(value: number): string {
  if (value === 0) return '0';
  if (value < 0.01) return '<0.01';
  if (value >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function BreakdownTooltipContent({ items, emptyLabel = 'No holdings' }: { items: AssetBreakdownItem[]; emptyLabel?: string }) {
  if (items.length === 0) {
    return <span className="text-secondary text-xs">{emptyLabel}</span>;
  }

  return (
    <div className="space-y-2 min-w-[180px]">
      {items.map((item) => (
        <div
          key={`${item.tokenAddress}-${item.chainId}`}
          className="flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2">
            <TokenIcon
              address={item.tokenAddress}
              chainId={item.chainId}
              symbol={item.symbol}
              width={16}
              height={16}
            />
            <span>
              {formatBalance(item.balance)} {item.symbol}
            </span>
          </div>
          <span className="ml-4 text-secondary">{formatUsdValue(item.usdValue)}</span>
        </div>
      ))}
    </div>
  );
}

function ValueBlock({
  label,
  value,
  isLoading,
  error,
  align,
  inlineMetric,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  error: Error | null;
  align: 'start' | 'end';
  inlineMetric?: ReactNode;
}) {
  const alignmentClass = align === 'start' ? 'items-start' : 'items-end';
  const loaderAlignmentClass = align === 'start' ? 'justify-start' : 'justify-end';
  const valueAlignmentClass = align === 'start' ? 'justify-start' : 'justify-end';

  return (
    <div className={`flex flex-col gap-1 ${alignmentClass}`}>
      <span className="text-xs leading-4 text-secondary">{label}</span>
      {isLoading ? (
        <div className={`${VALUE_TEXT_CLASS} min-h-8 sm:min-h-9 flex items-center ${loaderAlignmentClass}`}>
          <PulseLoader
            size={4}
            color="#f45f2d"
            margin={2}
          />
        </div>
      ) : error ? (
        <span className={`${VALUE_TEXT_CLASS} text-secondary`}>—</span>
      ) : (
        <span className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${valueAlignmentClass}`}>
          <span className={VALUE_TEXT_CLASS}>{formatUsdValue(value)}</span>
          {inlineMetric}
        </span>
      )}
    </div>
  );
}

export function PortfolioValueBadge({
  totalUsd,
  totalDebtUsd,
  assetBreakdown,
  debtBreakdown,
  isLoading,
  error,
  align = 'end',
  className = '',
  depositInlineMetric,
}: PortfolioValueBadgeProps) {
  const valueContent = (
    <ValueBlock
      label="Total Deposit"
      value={totalUsd}
      isLoading={isLoading}
      error={error}
      align={align}
      inlineMetric={depositInlineMetric}
    />
  );

  const debtContentBlock =
    !isLoading && !error && totalDebtUsd > 0 ? (
      <ValueBlock
        label="Total Debt"
        value={totalDebtUsd}
        isLoading={false}
        error={null}
        align={align}
      />
    ) : null;

  return (
    <div className={`flex items-start gap-8 ${className}`}>
      {isLoading || error ? (
        valueContent
      ) : (
        <Tooltip
          content={<BreakdownTooltipContent items={assetBreakdown} />}
          placement="bottom"
        >
          <span>{valueContent}</span>
        </Tooltip>
      )}
      {debtContentBlock && <span className="h-7 self-center border-l border-dashed border-border/70" />}
      {debtContentBlock && (
        <Tooltip
          content={
            <BreakdownTooltipContent
              items={debtBreakdown}
              emptyLabel="No borrows"
            />
          }
          placement="bottom"
        >
          <span>{debtContentBlock}</span>
        </Tooltip>
      )}
    </div>
  );
}
