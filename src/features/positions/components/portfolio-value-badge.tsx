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
};

const VALUE_TEXT_CLASS = 'font-zen text-2xl font-normal tabular-nums sm:text-2xl';

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

function ValueBlock({ label, value, isLoading, error }: { label: string; value: number; isLoading: boolean; error: Error | null }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs text-secondary">{label}</span>
      {isLoading ? (
        <div className={`${VALUE_TEXT_CLASS} min-h-8 sm:min-h-9 flex items-center justify-end`}>
          <PulseLoader
            size={4}
            color="#f45f2d"
            margin={2}
          />
        </div>
      ) : error ? (
        <span className={`${VALUE_TEXT_CLASS} text-secondary`}>—</span>
      ) : (
        <span className={VALUE_TEXT_CLASS}>{formatUsdValue(value)}</span>
      )}
    </div>
  );
}

export function PortfolioValueBadge({ totalUsd, totalDebtUsd, assetBreakdown, debtBreakdown, isLoading, error }: PortfolioValueBadgeProps) {
  const valueContent = (
    <ValueBlock
      label="Total Deposit"
      value={totalUsd}
      isLoading={isLoading}
      error={error}
    />
  );

  const debtContentBlock =
    !isLoading && !error && totalDebtUsd > 0 ? (
      <ValueBlock
        label="Total Debt"
        value={totalDebtUsd}
        isLoading={false}
        error={null}
      />
    ) : null;

  return (
    <div className="flex items-start gap-8">
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
