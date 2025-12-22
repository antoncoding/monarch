import { formatUsdValue } from '@/utils/portfolio';

type PortfolioValueBadgeProps = {
  totalUsd: number;
  isLoading: boolean;
  error: Error | null;
  onClick?: () => void;
};

export function PortfolioValueBadge({ totalUsd, isLoading, error, onClick }: PortfolioValueBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-end gap-1 transition-colors"
    >
      <span className="text-xs text-secondary">Total Value</span>
      {isLoading ? (
        <span className="font-zen text-2xl font-normal text-secondary">Calculating...</span>
      ) : error ? (
        <span className="font-zen text-2xl font-normal text-secondary sm:text-3xl">—</span>
      ) : (
        <span className="font-zen text-2xl font-normal sm:text-3xl">{formatUsdValue(totalUsd)}</span>
      )}
    </button>
  );
}
