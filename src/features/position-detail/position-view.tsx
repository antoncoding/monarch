'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection } from 'wagmi';
import { PeriodSelector } from '@/components/common/period-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { usePositionDetailPreferences } from '@/stores/usePositionDetailPreferences';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { usePositionDetailData } from './hooks/usePositionDetailData';
import { PositionBreadcrumbs } from './components/position-breadcrumbs';
import { PositionHeader } from './components/position-header';
import { OverviewTab } from './components/overview-tab';
import { HistoryTab } from './components/history-tab';
import {
  formatReportRangeLabel,
  getReportRangeTimestamps,
  ReportRangePicker,
  type ReportCustomRange,
} from './components/report-range-picker';
import type { SupportedNetworks } from '@/utils/networks';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { usesCompletedUtcDays } from '@/utils/earnings-period';

type PositionDetailContentProps = {
  chainId: number;
  loanAssetAddress: string;
  userAddress: string;
};

const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  day: '24h',
  week: '7d',
  month: '30d',
  threemonth: '3M',
  sixmonth: '6mo',
  all: 'All time',
};

type PositionDetailTab = 'analysis' | 'history';

export default function PositionDetailContent({ chainId, loanAssetAddress, userAddress }: PositionDetailContentProps) {
  const _router = useRouter();
  const { address: connectedAddress } = useConnection();
  const [selectedTab, setSelectedTab] = useState<PositionDetailTab>('analysis');
  const [customRange, setCustomRange] = useState<ReportCustomRange | null>(null);
  const { addVisitedAddress, addVisitedPosition } = usePortfolioBookmarks();

  // Preferences (period)
  const period = usePositionDetailPreferences((s) => s.period);
  const setPeriod = usePositionDetailPreferences((s) => s.setPeriod);
  const reportCustomRange = useMemo(() => getReportRangeTimestamps(customRange), [customRange]);

  // Check if current user is the position owner
  const isOwner = connectedAddress === userAddress;

  // Get token info for early display
  const { findToken } = useTokensQuery();
  const tokenInfo = findToken(loanAssetAddress, chainId);
  const loanAssetSymbol = tokenInfo?.symbol;

  // Markets loading (needed for some data)
  const { loading: isMarketsLoading } = useProcessedMarkets();

  // Position data
  const {
    currentPosition,
    allPositions,
    isLoading: isPositionsLoading,
    isEarningsLoading,
    isRefetching,
    refetch,
    actualBlockData,
    snapshotsByChain,
    endSnapshotsByChain,
    earningsRangesByChain,
  } = usePositionDetailData({
    chainId: chainId as SupportedNetworks,
    loanAssetAddress,
    userAddress,
    period,
    customRange: reportCustomRange,
  });

  const isLoading = isMarketsLoading || isPositionsLoading;
  const hasCustomRange = Boolean(reportCustomRange);
  const periodLabel = hasCustomRange && customRange ? formatReportRangeLabel(customRange) : PERIOD_LABELS[period];
  const reportRange = earningsRangesByChain[chainId];
  const requiresEndSnapshots = hasCustomRange || usesCompletedUtcDays(period);

  // Handle refetch
  const handleRefetch = () => {
    refetch();
  };

  const handlePeriodChange = (nextPeriod: EarningsPeriod) => {
    setCustomRange(null);
    setPeriod(nextPeriod);
  };

  useEffect(() => {
    if (userAddress) {
      addVisitedAddress(userAddress);
    }
  }, [userAddress, addVisitedAddress]);

  useEffect(() => {
    if (!userAddress || !loanAssetAddress || !chainId) return;
    addVisitedPosition({
      address: userAddress,
      chainId,
      loanAssetAddress,
      loanAssetSymbol,
    });
  }, [userAddress, chainId, loanAssetAddress, loanAssetSymbol, addVisitedPosition]);

  // Always render the shell - progressive loading
  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 pb-12">
        <Tabs
          value={selectedTab}
          onValueChange={(value) => setSelectedTab(value as PositionDetailTab)}
          className="w-full"
        >
          {/* Breadcrumbs - always visible */}
          <div className="mt-6 min-h-10 flex items-center">
            <PositionBreadcrumbs
              userAddress={userAddress}
              chainId={chainId as SupportedNetworks}
              loanAssetAddress={loanAssetAddress}
              loanAssetSymbol={currentPosition?.loanAssetSymbol ?? loanAssetSymbol}
              allPositions={allPositions}
            />
          </div>

          {/* Position Header - supports loading state, includes earnings */}
          <PositionHeader
            groupedPosition={currentPosition}
            chainId={chainId as SupportedNetworks}
            userAddress={userAddress}
            allPositions={allPositions}
            loanAssetAddress={loanAssetAddress}
            loanAssetSymbol={loanAssetSymbol}
            onRefetch={handleRefetch}
            isRefetching={isRefetching}
            isLoading={isLoading}
            isEarningsLoading={isEarningsLoading}
            periodLabel={periodLabel}
          />

          <div className="mt-6 flex flex-col gap-2 border-b border-border sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-8 border-b-0 w-auto">
              <TabsTrigger
                value="analysis"
                className="text-sm mr-4 first:mr-4"
              >
                Analysis
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="text-sm mr-4 first:mr-4"
              >
                History
              </TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-2 pb-1 sm:justify-end">
              <span className="text-xs uppercase tracking-wider text-secondary">Period</span>
              <PeriodSelector
                period={period}
                onPeriodChange={handlePeriodChange}
                className={`h-8 w-[110px] text-xs ${hasCustomRange ? 'border-border/60 bg-hovered/40 text-secondary opacity-70' : ''}`}
                contentClassName="z-[3600]"
              />
              <ReportRangePicker
                value={customRange}
                onChange={setCustomRange}
                onClear={() => setCustomRange(null)}
              />
            </div>
          </div>

          {/* No position found - show after loading completes */}
          {!isLoading && !currentPosition && (
            <div className="mt-8">
              <EmptyScreen
                message="No position found for this asset on this network."
                className="mt-10"
              />
            </div>
          )}

          {/* Loading skeleton for tab content */}
          {isLoading && !currentPosition && (
            <div className="space-y-6 mt-4">
              <div className="h-12 w-full animate-pulse rounded bg-hovered" />
              <div className="h-[300px] w-full animate-pulse rounded bg-hovered" />
            </div>
          )}

          {currentPosition && (
            <>
              <TabsContent value="analysis">
                <OverviewTab
                  groupedPosition={currentPosition}
                  chainId={chainId as SupportedNetworks}
                  isEarningsLoading={isEarningsLoading}
                  actualBlockData={actualBlockData}
                  periodLabel={periodLabel}
                  reportRange={reportRange}
                  isOwner={isOwner}
                  onRefetch={handleRefetch}
                  isRefetching={isRefetching}
                />
              </TabsContent>

              <TabsContent value="history">
                <HistoryTab
                  groupedPosition={currentPosition}
                  chainId={chainId as SupportedNetworks}
                  userAddress={userAddress}
                  snapshotsByChain={snapshotsByChain}
                  endSnapshotsByChain={endSnapshotsByChain}
                  actualBlockData={actualBlockData}
                  reportRange={reportRange}
                  requiresEndSnapshots={requiresEndSnapshots}
                  period={period}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
