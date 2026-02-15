'use client';

import { MarketsBreakdownTable } from './markets-breakdown-table';
import { YieldAnalysisDistribution } from './yield-analysis-distribution';
import { YieldAnalysisYieldBreakdown } from './yield-analysis-yield-breakdown';
import type { GroupedPosition } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type OverviewTabProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: EarningsPeriod;
  isOwner: boolean;
  onRefetch: () => void;
  isRefetching: boolean;
};

const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  day: '24h',
  week: '7d',
  month: '30d',
  sixmonth: '6mo',
  all: 'All time',
};

export function OverviewTab({
  groupedPosition,
  chainId,
  isEarningsLoading,
  actualBlockData,
  period,
  isOwner,
  onRefetch,
  isRefetching,
}: OverviewTabProps) {
  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <YieldAnalysisDistribution
          markets={groupedPosition.markets}
          periodLabel={periodLabel}
        />
        <YieldAnalysisYieldBreakdown
          markets={groupedPosition.markets}
          periodLabel={periodLabel}
        />
      </div>
      <MarketsBreakdownTable
        markets={groupedPosition.markets}
        chainId={chainId}
        isEarningsLoading={isEarningsLoading}
        actualBlockData={actualBlockData}
        periodLabel={periodLabel}
        isOwner={isOwner}
        onRefetch={onRefetch}
        isRefetching={isRefetching}
      />
    </div>
  );
}
