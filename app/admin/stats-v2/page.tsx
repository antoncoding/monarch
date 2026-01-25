'use client';

/**
 * Stats V2 Dashboard (Experimental)
 *
 * This page uses a new cross-chain indexer API that provides Monarch transaction
 * data across all chains with a single API call.
 *
 * NOTE: This API is experimental and may be reverted due to cost concerns.
 * The old stats page at /admin/stats should be kept as a fallback.
 *
 * Features:
 * - Cross-chain volume aggregation
 * - Volume breakdown by chain
 * - Supply and withdraw transaction tables
 * - ETH/BTC price estimation for USD values
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/button-group';
import { Spinner } from '@/components/ui/spinner';
import { PasswordGate } from '@/features/admin-v2/components/password-gate';
import { StatsOverviewCards } from '@/features/admin-v2/components/stats-overview-cards';
import { StatsVolumeChart } from '@/features/admin-v2/components/stats-volume-chart';
import { ChainVolumeChart } from '@/features/admin-v2/components/chain-volume-chart';
import { StatsTransactionsTable } from '@/features/admin-v2/components/stats-transactions-table';
import { useMonarchTransactions, type TimeFrame } from '@/hooks/useMonarchTransactions';
import { useAdminAuth } from '@/stores/useAdminAuth';

function StatsV2Content() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('30D');
  const { logout } = useAdminAuth();

  const {
    transactions,
    supplies,
    withdraws,
    chainStats,
    dailyVolumes,
    totalSupplyVolumeUsd,
    totalWithdrawVolumeUsd,
    totalVolumeUsd,
    isLoading,
    error,
  } = useMonarchTransactions(timeframe);

  const timeframeOptions = [
    { key: '1D', label: '1D', value: '1D' },
    { key: '7D', label: '7D', value: '7D' },
    { key: '30D', label: '30D', value: '30D' },
    { key: '90D', label: '90D', value: '90D' },
    { key: 'ALL', label: 'ALL', value: 'ALL' },
  ];

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 font-inter">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
          <h2 className="font-zen text-lg text-red-500">Error Loading Data</h2>
          <p className="mt-2 text-sm text-secondary">{error.message}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 font-inter">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-zen text-2xl font-bold">Stats V2</h1>
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">Experimental</span>
          </div>
          <p className="mt-1 text-sm text-secondary">
            Cross-chain Monarch transaction analytics. This API may be reverted due to cost concerns.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ButtonGroup
            options={timeframeOptions}
            value={timeframe}
            onChange={(value) => setTimeframe(value as TimeFrame)}
            size="sm"
            variant="default"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
          >
            Logout
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 w-full items-center justify-center">
          <Spinner size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Cards */}
          <StatsOverviewCards
            totalSupplyVolumeUsd={totalSupplyVolumeUsd}
            totalWithdrawVolumeUsd={totalWithdrawVolumeUsd}
            totalVolumeUsd={totalVolumeUsd}
            supplyCount={supplies.length}
            withdrawCount={withdraws.length}
            chainStats={chainStats}
          />

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-1">
            {/* Aggregated Volume Chart */}
            <StatsVolumeChart
              dailyVolumes={dailyVolumes}
              totalSupplyVolumeUsd={totalSupplyVolumeUsd}
              totalWithdrawVolumeUsd={totalWithdrawVolumeUsd}
              isLoading={isLoading}
            />

            {/* Chain Breakdown Chart */}
            <ChainVolumeChart
              dailyVolumes={dailyVolumes}
              chainStats={chainStats}
              isLoading={isLoading}
            />
          </div>

          {/* Transactions Table */}
          <StatsTransactionsTable
            transactions={transactions}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}

export default function StatsV2Page() {
  return (
    <PasswordGate>
      <StatsV2Content />
    </PasswordGate>
  );
}
