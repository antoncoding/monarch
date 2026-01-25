'use client';

import { Card, CardBody } from '@/components/ui/card';
import { formatReadable } from '@/utils/balance';
import type { ChainStats } from '@/hooks/useMonarchTransactions';

type StatsOverviewCardsProps = {
  totalSupplyVolumeUsd: number;
  totalWithdrawVolumeUsd: number;
  totalVolumeUsd: number;
  supplyCount: number;
  withdrawCount: number;
  chainStats: ChainStats[];
};

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <Card className="rounded-md bg-surface shadow-sm">
      <CardBody className="p-4">
        <h3 className="font-inter text-sm text-secondary">{title}</h3>
        <div className="mt-2">
          <p className="font-zen text-2xl">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-secondary">{subtitle}</p>}
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
}: StatsOverviewCardsProps) {
  const totalTransactions = supplyCount + withdrawCount;
  const activeChains = chainStats.length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Volume"
        value={`$${formatReadable(totalVolumeUsd)}`}
        subtitle="Supply + Withdraw"
      />
      <StatCard
        title="Supply Volume"
        value={`$${formatReadable(totalSupplyVolumeUsd)}`}
        subtitle={`${supplyCount} transactions`}
      />
      <StatCard
        title="Withdraw Volume"
        value={`$${formatReadable(totalWithdrawVolumeUsd)}`}
        subtitle={`${withdrawCount} transactions`}
      />
      <StatCard
        title="Total Transactions"
        value={totalTransactions.toLocaleString()}
        subtitle={`Across ${activeChains} chain${activeChains !== 1 ? 's' : ''}`}
      />
    </div>
  );
}
