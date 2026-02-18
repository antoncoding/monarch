import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/components';
import { formatOracleDuration, formatOracleTimestamp, type FeedFreshnessStatus } from '@/utils/oracle';

type FeedFreshnessSectionProps = {
  feedFreshness?: FeedFreshnessStatus;
  className?: string;
};

export function FeedFreshnessSection({ feedFreshness, className }: FeedFreshnessSectionProps) {
  if (!feedFreshness) return null;

  const updatedAt = feedFreshness.updatedAt;
  const normalizedPrice = feedFreshness.normalizedPrice;
  const hasTimestamp = updatedAt != null;
  const hasPrice = normalizedPrice != null;
  const isDerived = feedFreshness.updateKind === 'derived';
  if (!hasTimestamp && !hasPrice && !isDerived) return null;

  return (
    <div className={cn('space-y-1 border-t border-gray-200/30 pt-2 dark:border-gray-600/20', className)}>
      {normalizedPrice != null && (
        <div className="flex items-center justify-between gap-1">
          <span className="font-zen text-xs text-gray-600 dark:text-gray-400">Price:</span>
          <span className="font-zen text-xs font-medium">{normalizedPrice}</span>
        </div>
      )}

      {updatedAt != null && (
        <div className="flex items-center justify-between gap-1">
          <span className="font-zen text-xs text-gray-600 dark:text-gray-400">Last Updated:</span>
          <span className="whitespace-nowrap text-right font-zen text-xs font-medium">{formatOracleTimestamp(updatedAt)}</span>
        </div>
      )}

      {feedFreshness.ageSeconds != null && (
        <div className="flex items-center justify-between gap-1">
          <span className="font-zen text-xs text-gray-600 dark:text-gray-400">Age:</span>
          <span className="text-right font-zen text-xs font-medium">{formatOracleDuration(feedFreshness.ageSeconds)} ago</span>
        </div>
      )}

      {isDerived && (
        <div className="flex items-center justify-between gap-1">
          <span className="font-zen text-xs text-gray-600 dark:text-gray-400">Mode:</span>
          <Badge
            variant="primary"
            size="sm"
            className="font-zen"
          >
            DERIVED
          </Badge>
        </div>
      )}

      {feedFreshness.isStale && feedFreshness.staleAfterSeconds != null && (
        <div className="flex items-center justify-between gap-1">
          <span className="font-zen text-xs text-gray-600 dark:text-gray-400">Status:</span>
          <span className="text-right font-zen text-xs font-medium text-yellow-700 dark:text-yellow-300">Stale</span>
        </div>
      )}
    </div>
  );
}
