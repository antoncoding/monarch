import { Tooltip } from '@/components/ui/tooltip';
import { TokenIcon } from '@/components/shared/token-icon';
import { type AssetBreakdownItem, formatUsdValue } from '@/utils/portfolio';
import { PulseLoader } from 'react-spinners';

type PortfolioValueBadgeProps = {
  totalUsd: number;
  assetBreakdown: AssetBreakdownItem[];
  isLoading: boolean;
  error: Error | null;
};

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

function BreakdownTooltipContent({ items }: { items: AssetBreakdownItem[] }) {
  if (items.length === 0) {
    return <span className="text-secondary text-xs">No holdings</span>;
  }

  return (
    <div className="space-y-2 min-w-[180px]">
      {items.map((item) => (
        <div key={`${item.tokenAddress}-${item.chainId}`} className="flex items-center justify-between text-xs">
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

export function PortfolioValueBadge({ totalUsd, assetBreakdown, isLoading, error }: PortfolioValueBadgeProps) {
  const content = (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs text-secondary">Total Value</span>
      {isLoading ? (
        <div className="font-zen text-2xl font-normal sm:text-3xl min-h-8 sm:min-h-9 flex items-center justify-end">
          <PulseLoader size={4} color="#f45f2d" margin={2} />
        </div>
      ) : error ? (
        <span className="font-zen text-2xl font-normal text-secondary sm:text-2xl">—</span>
      ) : (
        <span className="font-zen text-2xl font-normal sm:text-2xl">{formatUsdValue(totalUsd)}</span>
      )}
    </div>
  );

  if (isLoading || error) {
    return content;
  }

  return (
    <Tooltip content={<BreakdownTooltipContent items={assetBreakdown} />} placement="bottom">
      <span>{content}</span>
    </Tooltip>
  );
}
