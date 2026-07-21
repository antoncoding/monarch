'use client';

import Link from 'next/link';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { UserPositionsChart, UserPositionsChartSkeleton } from '@/features/positions/components/user-positions-chart';
import { usePositionChartTransactions } from '@/hooks/usePositionChartTransactions';
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
  threemonth: '3M',
  sixmonth: '6mo',
  all: 'All time',
};

type VaultAdapterPositionOverviewProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  adapterAddress: Address;
  isEarningsLoading: boolean;
  isSnapshotsLoading: boolean;
  isTransactionsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: EarningsPeriod;
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  marketAllocations: MarketAllocation[];
  assetAddress?: Address;
  totalAssets?: bigint;
  transactions: UserTransaction[];
};

type VaultMarketBreakdownTableProps = {
  positions: MarketPositionWithEarnings[];
  chainId: SupportedNetworks;
  detailHref: string;
  isEarningsLoading: boolean;
  periodLabel: string;
  marketAllocations: MarketAllocation[];
  assetAddress?: Address;
  totalAssets?: bigint;
};

function VaultMarketBreakdownTable({
  positions,
  chainId,
  detailHref,
  isEarningsLoading,
  periodLabel,
  marketAllocations,
  assetAddress,
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
        allocationAssetAddress={assetAddress}
      />
    </TableContainerWithHeader>
  );
}

export function VaultAdapterPositionOverview({
  groupedPosition,
  chainId,
  adapterAddress,
  isEarningsLoading,
  isSnapshotsLoading,
  isTransactionsLoading,
  actualBlockData,
  period,
  snapshotsByChain,
  marketAllocations,
  assetAddress,
  totalAssets,
  transactions,
}: VaultAdapterPositionOverviewProps) {
  const periodLabel = PERIOD_LABELS[period];
  const detailHref = `/position/${chainId}/${groupedPosition.loanAssetAddress}/${adapterAddress}`;
  const chartStartTimestamp = actualBlockData[chainId]?.timestamp;
  const {
    transactions: allTimeTransactions,
    isLoading: isLoadingAllTimeTransactions,
    error: allTimeTransactionError,
  } = usePositionChartTransactions({
    account: adapterAddress,
    enabled: period === 'all',
    groupedPosition,
    startTimestamp: chartStartTimestamp,
    useDailyBuckets: true,
  });
  const chartTransactions = period === 'all' ? allTimeTransactions : transactions;
  const isChartLoading = chartStartTimestamp === undefined || isSnapshotsLoading || (period === 'all' && isLoadingAllTimeTransactions);
  const chartError = period === 'all' ? allTimeTransactionError : null;
  const chartActions =
    period !== 'all' && isTransactionsLoading ? (
      <span className="flex items-center gap-1.5 text-[11px] text-secondary">
        <Spinner size={12} />
        Updating
      </span>
    ) : undefined;

  return (
    <div className="space-y-4">
      {isChartLoading ? (
        <UserPositionsChartSkeleton
          height={220}
          title="Vault exposure over time"
        />
      ) : chartError ? (
        <div
          role="alert"
          className="flex min-h-[220px] items-center justify-center text-sm text-secondary"
        >
          Position history is temporarily unavailable.
        </div>
      ) : (
        <UserPositionsChart
          variant="grouped"
          groupedPosition={groupedPosition}
          transactions={chartTransactions}
          snapshotsByChain={snapshotsByChain}
          chainBlockData={actualBlockData}
          actions={chartActions}
          height={220}
          title="Vault exposure over time"
        />
      )}
      <VaultMarketBreakdownTable
        positions={groupedPosition.markets}
        chainId={chainId}
        detailHref={detailHref}
        isEarningsLoading={isEarningsLoading}
        periodLabel={periodLabel}
        marketAllocations={marketAllocations}
        assetAddress={assetAddress}
        totalAssets={totalAssets}
      />
    </div>
  );
}
