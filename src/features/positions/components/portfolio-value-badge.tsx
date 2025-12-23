import { formatUsdValue } from '@/utils/portfolio';
import { PulseLoader } from 'react-spinners';

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
        <div className="font-zen text-2xl font-normal sm:text-3xl min-h-8 sm:min-h-9 flex items-center justify-end">
          <PulseLoader
            size={4}
            color="#f45f2d"
            margin={2}
          />
        </div>
      ) : error ? (
        <span className="font-zen text-2xl font-normal text-secondary sm:text-2xl">—</span>
      ) : (
        <span className="font-zen text-2xl font-normal sm:text-2xl">{formatUsdValue(totalUsd)}</span>
      )}
    </button>
  );
}
