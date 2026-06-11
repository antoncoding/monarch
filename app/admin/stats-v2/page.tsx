'use client';

/**
 * Admin Stats Dashboard
 *
 * This page uses the shared Monarch API to provide cross-chain Monarch
 * transaction data across all chains with a single GraphQL endpoint.
 *
 * Features:
 * - Cross-chain volume aggregation
 * - Volume breakdown by chain
 * - Supply and withdraw transaction tables
 * - ETH/BTC price estimation for USD values
 */

import { useState } from 'react';
import { ExitIcon } from '@radix-ui/react-icons';
import { PeriodSelector, type PeriodSelectorOption } from '@/components/common/period-selector';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import { PasswordGate } from '@/features/admin-v2/components/password-gate';
import { StatsOverviewCards } from '@/features/admin-v2/components/stats-overview-cards';
import { StatsVolumeChart } from '@/features/admin-v2/components/stats-volume-chart';
import { ChainVolumeChart } from '@/features/admin-v2/components/chain-volume-chart';
import { MarketGroupVolumeChart } from '@/features/admin-v2/components/market-group-volume-chart';
import { StatsTransactionsTable } from '@/features/admin-v2/components/stats-transactions-table';
import { StatsAssetTable } from '@/features/admin-v2/components/stats-asset-table';
import { StatsMarketTable } from '@/features/admin-v2/components/stats-market-table';
import { useMonarchTransactions, type TimeFrame } from '@/hooks/useMonarchTransactions';
import { useAdminAuth } from '@/stores/useAdminAuth';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

const TIMEFRAME_TO_PERIOD: Record<TimeFrame, EarningsPeriod> = {
  '1D': 'day',
  '7D': 'week',
  '30D': 'month',
  '90D': 'threemonth',
  ALL: 'all',
};

const PERIOD_TO_TIMEFRAME: Partial<Record<EarningsPeriod, TimeFrame>> = {
  day: '1D',
  week: '7D',
  month: '30D',
  threemonth: '90D',
  all: 'ALL',
};

const ADMIN_STATS_PERIOD_OPTIONS: readonly PeriodSelectorOption[] = [
  { value: 'day', label: '24h' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
  { value: 'threemonth', label: '90 days' },
  { value: 'all', label: 'All time' },
];

function StatsV2Content() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('30D');
  const { logout } = useAdminAuth();
  const selectedPeriod = TIMEFRAME_TO_PERIOD[timeframe];

  const {
    transactions,
    supplies,
    withdraws,
    borrows,
    chainStats,
    dailyVolumes,
    totalSupplyVolumeUsd,
    totalWithdrawVolumeUsd,
    totalVolumeUsd,
    isLoading,
    error,
  } = useMonarchTransactions(timeframe);

  const handlePeriodChange = (period: EarningsPeriod) => {
    const nextTimeframe = PERIOD_TO_TIMEFRAME[period];

    if (nextTimeframe) {
      setTimeframe(nextTimeframe);
    }
  };

  if (error) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="rounded border border-border bg-surface p-6 text-center shadow-sm">
            <h2 className="text-sm text-red-500">Error Loading Data</h2>
            <p className="mt-2 text-sm text-secondary">{error.message}</p>
            <Button
              className="mt-4 font-normal"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col font-zen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-zen text-2xl">Monarch Stats</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="text-xs uppercase tracking-wider text-secondary">Period</span>
            <PeriodSelector
              className="h-8 w-[110px] text-xs"
              contentClassName="z-[3600]"
              onPeriodChange={handlePeriodChange}
              options={ADMIN_STATS_PERIOD_OPTIONS}
              period={selectedPeriod}
            />
            <Button
              aria-label="Log out"
              className="font-normal text-secondary hover:text-primary"
              onClick={() => {
                void logout();
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ExitIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Overview Cards */}
          <StatsOverviewCards
            totalSupplyVolumeUsd={totalSupplyVolumeUsd}
            totalWithdrawVolumeUsd={totalWithdrawVolumeUsd}
            totalVolumeUsd={totalVolumeUsd}
            supplyCount={supplies.length}
            withdrawCount={withdraws.length}
            chainStats={chainStats}
            isLoading={isLoading}
          />

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-1">
            {/* Aggregated Volume Chart */}
            <StatsVolumeChart
              dailyVolumes={dailyVolumes}
              isLoading={isLoading}
            />

            {/* Chain Breakdown Chart */}
            <ChainVolumeChart
              dailyVolumes={dailyVolumes}
              chainStats={chainStats}
              isLoading={isLoading}
            />

            <MarketGroupVolumeChart
              supplies={supplies}
              borrows={borrows}
              isLoading={isLoading}
            />
          </div>

          {/* Transactions Table */}
          <StatsTransactionsTable
            transactions={transactions}
            isLoading={isLoading}
          />

          {/* Asset Metrics Table */}
          <StatsAssetTable
            transactions={transactions}
            isLoading={isLoading}
          />

          {/* Market Metrics Table */}
          <StatsMarketTable
            transactions={transactions}
            isLoading={isLoading}
          />
        </div>
      </div>
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
