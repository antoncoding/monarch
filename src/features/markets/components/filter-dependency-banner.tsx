'use client';

import { useMemo } from 'react';
import { DataNoticeBanner, type DataNotice } from '@/components/shared/data-notice-banner';
import { useMarketFilterDependencyStatus } from '@/hooks/useMarketFilterDependencyStatus';

export type MarketDataNotice = DataNotice;

type MarketFilterDependencyBannerProps = {
  notices?: MarketDataNotice[];
};

export function MarketFilterDependencyBanner({ notices = [] }: MarketFilterDependencyBannerProps) {
  const { affectedGuards } = useMarketFilterDependencyStatus();
  const allNotices = useMemo(() => [...affectedGuards, ...notices], [affectedGuards, notices]);

  return (
    <DataNoticeBanner
      notices={allNotices}
      title="Market data warning"
    />
  );
}
