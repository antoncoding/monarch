'use client';

import { useEffect, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { useDataNoticeDismissals } from '@/stores/useDataNoticeDismissals';

export type DataNotice = {
  id: string;
  impact: string;
};

type DataNoticeBannerProps = {
  notices?: DataNotice[];
  title?: string;
};

export function DataNoticeBanner({ notices = [], title = 'Some data is incomplete.' }: DataNoticeBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  const dismissedUntilById = useDataNoticeDismissals((state) => state.dismissedUntilById);
  const dismiss = useDataNoticeDismissals((state) => state.dismiss);
  const pruneExpired = useDataNoticeDismissals((state) => state.pruneExpired);

  const visibleNotices = useMemo(
    () => notices.filter((notice) => (dismissedUntilById[notice.id] ?? 0) <= now),
    [dismissedUntilById, notices, now],
  );

  useEffect(() => {
    const nextDismissalExpiry = Math.min(...Object.values(dismissedUntilById).filter((dismissedUntil) => dismissedUntil > now));
    if (!Number.isFinite(nextDismissalExpiry)) return;

    const timeoutId = window.setTimeout(
      () => {
        pruneExpired();
        setNow(Date.now());
      },
      Math.max(nextDismissalExpiry - now, 1000),
    );

    return () => window.clearTimeout(timeoutId);
  }, [dismissedUntilById, now, pruneExpired]);

  const handleDismiss = (id: string) => {
    dismiss(id);
    setNow(Date.now());
  };

  if (visibleNotices.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="mb-0 mt-2 rounded-sm border border-border bg-surface px-3 py-1.5 font-zen text-sm text-primary shadow-sm"
    >
      <div className="mb-0.5 text-xs font-normal leading-4 text-secondary">{title}</div>
      <div className="space-y-1 text-xs text-secondary">
        {visibleNotices.map((notice) => (
          <div
            key={notice.id}
            className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-start gap-2"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 h-4 w-[4px] bg-yellow-500"
            />
            <span className="min-w-0 leading-5">{notice.impact}</span>
            <button
              type="button"
              className="-mr-1 flex h-5 w-5 items-center justify-center rounded-sm text-secondary transition hover:bg-hovered hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600"
              aria-label="Dismiss notice for 2 hours"
              onClick={() => handleDismiss(notice.id)}
            >
              <IoClose className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
