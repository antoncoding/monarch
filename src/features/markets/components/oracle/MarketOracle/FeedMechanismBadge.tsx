import { Badge } from '@/components/ui/badge';
import { FEED_MECHANISM_INFO, type FeedMechanism, type FeedMechanismKind } from '@/utils/oracle';

const BADGE_CLASS_NAME = 'border border-violet-500/20 bg-violet-500/10 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300';

type FeedMechanismBadgeProps = {
  mechanism: FeedMechanism | FeedMechanismKind | null | undefined;
  className?: string;
};

export function FeedMechanismBadge({ mechanism, className }: FeedMechanismBadgeProps) {
  if (!mechanism) return null;

  const label = typeof mechanism === 'string' ? FEED_MECHANISM_INFO[mechanism].shortLabel : mechanism.label;

  return (
    <Badge
      size="sm"
      className={`${BADGE_CLASS_NAME} ${className ?? ''}`}
    >
      {label}
    </Badge>
  );
}
