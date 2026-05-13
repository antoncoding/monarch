'use client';

import { IoWarningOutline } from 'react-icons/io5';
import { useMarketFilterDependencyStatus } from '@/hooks/useMarketFilterDependencyStatus';

export type MarketDataNotice = {
  id: string;
  impact: string;
};

type MarketFilterDependencyBannerProps = {
  notices?: MarketDataNotice[];
};

export function MarketFilterDependencyBanner({ notices = [] }: MarketFilterDependencyBannerProps) {
  const { affectedGuards } = useMarketFilterDependencyStatus();
  const visibleNotices = [...affectedGuards, ...notices];

  if (visibleNotices.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="mt-2 flex items-start gap-2 rounded-sm border border-yellow-500/30 bg-yellow-50/70 px-3 py-2 font-zen text-sm text-primary shadow-sm dark:bg-yellow-950/20"
    >
      <IoWarningOutline className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Some market data is incomplete.</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-secondary">
          {visibleNotices.map((notice) => (
            <li key={notice.id}>{notice.impact}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
