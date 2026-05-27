'use client';

import { MarketsBreakdownTable } from './markets-breakdown-table';
import { YieldAnalysisDistribution } from './yield-analysis-distribution';
import { YieldAnalysisYieldBreakdown } from './yield-analysis-yield-breakdown';
import type { GroupedPosition } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import type { EarningsTimeRange } from '@/hooks/useUserPositionsSummaryData';

type OverviewTabProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  periodLabel: string;
  reportRange?: EarningsTimeRange;
  isOwner: boolean;
  onRefetch: () => void;
  isRefetching: boolean;
};

export function OverviewTab({
  groupedPosition,
  chainId,
  isEarningsLoading,
  actualBlockData,
  periodLabel,
  reportRange,
  isOwner,
  onRefetch,
  isRefetching,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <YieldAnalysisDistribution
          markets={groupedPosition.markets}
          periodLabel={periodLabel}
          isLoading={isEarningsLoading}
        />
        <YieldAnalysisYieldBreakdown
          markets={groupedPosition.markets}
          periodLabel={periodLabel}
          isLoading={isEarningsLoading}
        />
      </div>
      <MarketsBreakdownTable
        markets={groupedPosition.markets}
        chainId={chainId}
        isEarningsLoading={isEarningsLoading}
        actualBlockData={actualBlockData}
        periodLabel={periodLabel}
        reportRange={reportRange}
        isOwner={isOwner}
        onRefetch={onRefetch}
        isRefetching={isRefetching}
      />
    </div>
  );
}
