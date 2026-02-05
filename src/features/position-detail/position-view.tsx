'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection } from 'wagmi';
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
import { PositionPeriodSelector } from './components/position-period-selector';
import type { SupportedNetworks } from '@/utils/networks';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type PositionDetailContentProps = {
  chainId: number;
  loanAssetAddress: string;
  userAddress: string;
};

const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  day: '24h',
  week: '7d',
  month: '30d',
};

type PositionDetailTab = 'analysis' | 'history';

export default function PositionDetailContent({ chainId, loanAssetAddress, userAddress }: PositionDetailContentProps) {
  const _router = useRouter();
  const { address: connectedAddress } = useConnection();
  const [selectedTab, setSelectedTab] = useState<PositionDetailTab>('analysis');
  const { addVisitedAddress, addVisitedPosition } = usePortfolioBookmarks();

  // Preferences (period)
  const period = usePositionDetailPreferences((s) => s.period);
  const setPeriod = usePositionDetailPreferences((s) => s.setPeriod);

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
    transactions,
    snapshotsByChain,
  } = usePositionDetailData({
    chainId: chainId as SupportedNetworks,
    loanAssetAddress,
    userAddress,
    period,
  });

  const isLoading = isMarketsLoading || isPositionsLoading;
  const periodLabel = PERIOD_LABELS[period];

  // Filter transactions relevant to this position's markets
  const relevantTransactions = useMemo(() => {
    if (!currentPosition) return [];
    const marketKeys = new Set(currentPosition.markets.map((m) => m.market.uniqueKey.toLowerCase()));
    return transactions.filter((tx) => tx.data.market && marketKeys.has(tx.data.market.uniqueKey.toLowerCase()));
  }, [transactions, currentPosition]);

  // Handle refetch
  const handleRefetch = () => {
    refetch();
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
          <div className="mt-6">
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
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs uppercase tracking-wider text-secondary">Period</span>
              <PositionPeriodSelector
                period={period}
                onPeriodChange={setPeriod}
                className="h-8 w-[110px] text-xs"
                contentClassName="z-[3600]"
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
                  period={period}
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
                  transactions={relevantTransactions}
                  snapshotsByChain={snapshotsByChain}
                  actualBlockData={actualBlockData}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
