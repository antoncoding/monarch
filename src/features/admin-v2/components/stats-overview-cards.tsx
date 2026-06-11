'use client';

import { Card, CardBody } from '@/components/ui/card';
import { AdminMetricValue } from '@/features/admin-v2/components/admin-metric-value';
import { formatReadable } from '@/utils/balance';
import type { ChainStats } from '@/hooks/useMonarchTransactions';

type StatsOverviewCardsProps = {
  totalSupplyVolumeUsd: number;
  totalWithdrawVolumeUsd: number;
  totalVolumeUsd: number;
  supplyCount: number;
  withdrawCount: number;
  chainStats: ChainStats[];
  isLoading?: boolean;
};

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  isLoading?: boolean;
};

function StatCard({ title, value, subtitle, isLoading }: StatCardProps) {
  return (
    <Card className="border border-border bg-surface shadow-sm">
      <CardBody className="p-4">
        <h3 className="text-xs uppercase tracking-wider text-secondary">{title}</h3>
        <div className="mt-2">
          <AdminMetricValue
            value={value}
            isLoading={isLoading}
            className="text-xl"
            skeletonClassName="h-6 w-28"
          />
          {subtitle && (
            <p className="mt-1 text-xs text-secondary">
              {isLoading ? (
                <span
                  className="inline-block h-3 w-20 rounded-sm bg-hovered"
                  aria-hidden="true"
                />
              ) : (
                subtitle
              )}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function StatsOverviewCards({
  totalSupplyVolumeUsd,
  totalWithdrawVolumeUsd,
  totalVolumeUsd,
  supplyCount,
  withdrawCount,
  chainStats,
  isLoading,
}: StatsOverviewCardsProps) {
  const totalTransactions = supplyCount + withdrawCount;
  const activeChains = chainStats.length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Volume"
        value={`$${formatReadable(totalVolumeUsd)}`}
        subtitle="Supply + Withdraw"
        isLoading={isLoading}
      />
      <StatCard
        title="Supply Volume"
        value={`$${formatReadable(totalSupplyVolumeUsd)}`}
        subtitle={`${supplyCount} transactions`}
        isLoading={isLoading}
      />
      <StatCard
        title="Withdraw Volume"
        value={`$${formatReadable(totalWithdrawVolumeUsd)}`}
        subtitle={`${withdrawCount} transactions`}
        isLoading={isLoading}
      />
      <StatCard
        title="Total Transactions"
        value={totalTransactions.toLocaleString()}
        subtitle={`Across ${activeChains} chain${activeChains === 1 ? '' : 's'}`}
        isLoading={isLoading}
      />
    </div>
  );
}
