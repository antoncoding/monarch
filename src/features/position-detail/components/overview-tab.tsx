'use client';

import { MarketsBreakdownTable } from './markets-breakdown-table';
import type { GroupedPosition } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type OverviewTabProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: EarningsPeriod;
  onPeriodChange: (period: EarningsPeriod) => void;
  isOwner: boolean;
  onRefetch: () => void;
  isRefetching: boolean;
};

const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  day: '24h',
  week: '7d',
  month: '30d',
};

export function OverviewTab({
  groupedPosition,
  chainId,
  isEarningsLoading,
  actualBlockData,
  period,
  onPeriodChange,
  isOwner,
  onRefetch,
  isRefetching,
}: OverviewTabProps) {
  const periodLabel = PERIOD_LABELS[period];

  return (
    <MarketsBreakdownTable
      markets={groupedPosition.markets}
      chainId={chainId}
      isEarningsLoading={isEarningsLoading}
      actualBlockData={actualBlockData}
      period={period}
      periodLabel={periodLabel}
      onPeriodChange={onPeriodChange}
      isOwner={isOwner}
      onRefetch={onRefetch}
      isRefetching={isRefetching}
    />
  );
}
