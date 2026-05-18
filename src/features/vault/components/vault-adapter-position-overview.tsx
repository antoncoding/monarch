'use client';

import Link from 'next/link';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { UserPositionsChart } from '@/features/positions/components/user-positions-chart';
import { PositionPeriodSelector } from '@/features/position-detail/components/position-period-selector';
import { VaultMarketAllocationsTable } from '@/features/vault/components/vault-market-allocations-table';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import type { MarketAllocation } from '@/types/vaultAllocations';
import type { PositionSnapshot } from '@/utils/positions';
import type { GroupedPosition, MarketPositionWithEarnings, UserTransaction } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  day: '24h',
  week: '7d',
  month: '30d',
  sixmonth: '6mo',
  all: 'All time',
};

type VaultAdapterPositionOverviewProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  adapterAddress: Address;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: EarningsPeriod;
  setPeriod: (period: EarningsPeriod) => void;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  marketAllocations: MarketAllocation[];
  totalAssets?: bigint;
};

type VaultMarketBreakdownTableProps = {
  positions: MarketPositionWithEarnings[];
  chainId: SupportedNetworks;
  detailHref: string;
  isEarningsLoading: boolean;
  periodLabel: string;
  marketAllocations: MarketAllocation[];
  totalAssets?: bigint;
};

function VaultMarketBreakdownTable({
  positions,
  chainId,
  detailHref,
  isEarningsLoading,
  periodLabel,
  marketAllocations,
  totalAssets,
}: VaultMarketBreakdownTableProps) {
  const actions = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="min-w-0 px-2 text-secondary no-underline hover:text-primary hover:no-underline"
    >
      <Link href={detailHref}>
        Details
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );

  return (
    <TableContainerWithHeader
      title="Market Breakdown"
      actions={actions}
    >
      <VaultMarketAllocationsTable
        marketAllocations={marketAllocations}
        chainId={chainId}
        totalAssets={totalAssets}
        mode="position"
        positions={positions}
        periodLabel={periodLabel}
        isEarningsLoading={isEarningsLoading}
      />
    </TableContainerWithHeader>
  );
}

export function VaultAdapterPositionOverview({
  groupedPosition,
  chainId,
  adapterAddress,
  isEarningsLoading,
  actualBlockData,
  period,
  setPeriod,
  transactions,
  snapshotsByChain,
  marketAllocations,
  totalAssets,
}: VaultAdapterPositionOverviewProps) {
  const periodLabel = PERIOD_LABELS[period];
  const detailHref = `/position/${chainId}/${groupedPosition.loanAssetAddress}/${adapterAddress}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs uppercase tracking-wider text-secondary">Period</span>
        <PositionPeriodSelector
          period={period}
          onPeriodChange={setPeriod}
          className="h-8 w-[110px] text-xs"
          contentClassName="z-[3600]"
        />
      </div>
      <UserPositionsChart
        variant="grouped"
        groupedPosition={groupedPosition}
        transactions={transactions}
        snapshotsByChain={snapshotsByChain}
        chainBlockData={actualBlockData}
        height={220}
      />
      <VaultMarketBreakdownTable
        positions={groupedPosition.markets}
        chainId={chainId}
        detailHref={detailHref}
        isEarningsLoading={isEarningsLoading}
        periodLabel={periodLabel}
        marketAllocations={marketAllocations}
        totalAssets={totalAssets}
      />
    </div>
  );
}
