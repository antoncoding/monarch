import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/components';
import { formatOracleDuration, type FeedFreshnessStatus } from '@/utils/oracle';

type FeedFreshnessSectionProps = {
  feedFreshness?: FeedFreshnessStatus;
  className?: string;
};

export function FeedFreshnessSection({ feedFreshness, className }: FeedFreshnessSectionProps) {
  if (!feedFreshness) return null;

  const normalizedPrice = feedFreshness.normalizedPrice;
  const ageSeconds = feedFreshness.ageSeconds;
  const hasPrice = normalizedPrice != null;
  const hasAge = ageSeconds != null;
  const isDerived = feedFreshness.updateKind === 'derived';
  if (!hasAge && !hasPrice && !isDerived) return null;

  return (
    <div className={cn('space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20', className)}>
      {normalizedPrice != null && (
        <div className="flex items-center justify-between font-zen text-sm">
          <span className="text-gray-600 dark:text-gray-400">Feed Price:</span>
          <span className="font-medium tabular-nums">{normalizedPrice}</span>
        </div>
      )}

      {ageSeconds != null && (
        <div className="flex items-center justify-between font-zen text-sm">
          <span className="text-gray-600 dark:text-gray-400">Age:</span>
          <span className="font-medium">{formatOracleDuration(ageSeconds)} ago</span>
        </div>
      )}

      {isDerived && (
        <div className="flex items-center justify-between font-zen text-sm">
          <span className="text-gray-600 dark:text-gray-400">Mode:</span>
          <Badge
            variant="primary"
            size="sm"
            className="font-zen"
          >
            DERIVED
          </Badge>
        </div>
      )}

      {feedFreshness.isStale && (
        <div className="flex items-center justify-between font-zen text-sm">
          <span className="text-gray-600 dark:text-gray-400">Status:</span>
          <span className="font-medium text-yellow-700 dark:text-yellow-300">Stale</span>
        </div>
      )}
    </div>
  );
}
