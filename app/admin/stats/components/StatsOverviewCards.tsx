import React from 'react';
import { Card, CardBody } from '@nextui-org/card';
import { SupportedNetworks, getNetworkName } from '@/utils/networks';
import { PlatformStats } from '@/utils/statsUtils';

type StatsOverviewCardsProps = {
  stats: PlatformStats;
  selectedNetwork: SupportedNetworks;
}

function StatCard({ title, value, change, prefix = '' }: StatCardProps) {
  const changeText = change !== undefined ? (change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`) : '';
  const changeColor = change === undefined ? 'text-gray-500' : change > 0 ? 'text-green-500' : 'text-red-500';

  return (
    <Card className="bg-surface rounded-md shadow-sm">
      <CardBody className="p-4">
        <h3 className="text-sm font-medium text-gray-500 font-inter">{title}</h3>
        <div className="mt-2 flex items-baseline">
          <p className="text-2xl font-semibold font-zen">
            {prefix}
            {value}
          </p>
          {change !== undefined && (
            <span className={`ml-2 text-sm ${changeColor} font-inter`}>{changeText}</span>
          )}
        </div>
      </CardBody>
    </Card>
  );
} 

export function StatsOverviewCards({ stats, selectedNetwork }: StatsOverviewCardsProps) {
  // Network display name for context
  const networkName = getNetworkName(selectedNetwork) ?? 'Network';
  
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title={`Unique Users on ${networkName}`}
        value={stats.uniqueUsers.toLocaleString()}
        change={stats.uniqueUsersDelta}
      />
      <StatCard
        title={`Total Transactions on ${networkName}`}
        value={stats.totalTransactions.toLocaleString()}
        change={stats.totalTransactionsDelta}
      />
      <StatCard
        title={`Supply Transactions on ${networkName}`}
        value={stats.supplyCount.toLocaleString()}
        change={stats.supplyCountDelta}
      />
      <StatCard
        title={`Withdraw Transactions on ${networkName}`}
        value={stats.withdrawCount.toLocaleString()}
        change={stats.withdrawCountDelta}
      />
      <StatCard
        title={`Unique Markets on ${networkName}`}
        value={stats.activeMarkets.toLocaleString()}
      />
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string | number;
  change?: number;
  prefix?: string;
}
