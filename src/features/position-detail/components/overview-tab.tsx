'use client';

import { PositionPeriodSelector } from './position-period-selector';
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
}: OverviewTabProps) {
  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <span />
        <PositionPeriodSelector
          period={period}
          onPeriodChange={onPeriodChange}
          className="w-[120px]"
        />
      </div>

      {/* Markets Breakdown Table */}
      <MarketsBreakdownTable
        markets={groupedPosition.markets}
        chainId={chainId}
        isEarningsLoading={isEarningsLoading}
        actualBlockData={actualBlockData}
        periodLabel={periodLabel}
        isOwner={isOwner}
      />
    </div>
  );
}
