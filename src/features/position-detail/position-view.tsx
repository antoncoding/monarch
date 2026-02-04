'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection } from 'wagmi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import { UserPositionsChart } from '@/features/positions/components/user-positions-chart';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { usePositionDetailPreferences, type PositionDetailTab } from '@/stores/usePositionDetailPreferences';
import { usePositionDetailData } from './hooks/usePositionDetailData';
import { PositionBreadcrumbs } from './components/position-breadcrumbs';
import { PositionHeader } from './components/position-header';
import { OverviewTab } from './components/overview-tab';
import { HistoryTab } from './components/history-tab';
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

export default function PositionDetailContent({ chainId, loanAssetAddress, userAddress }: PositionDetailContentProps) {
  const router = useRouter();
  const { address: connectedAddress } = useConnection();

  // Preferences (tab + period)
  const selectedTab = usePositionDetailPreferences((s) => s.selectedTab);
  const setSelectedTab = usePositionDetailPreferences((s) => s.setSelectedTab);
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

  // Always render the shell - progressive loading
  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 pb-12">
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

        {/* No position found - show after loading completes */}
        {!isLoading && !currentPosition && (
          <div className="mt-8">
            <EmptyScreen
              message="No position found for this asset on this network."
              className="mt-10"
            />
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => router.push(`/positions/${userAddress}`)}
                className="text-primary hover:underline"
              >
                View all positions
              </button>
            </div>
          </div>
        )}

        {/* Position History Chart - Always visible above tabs */}
        {currentPosition && (
          <div className="mt-6">
            <UserPositionsChart
              variant="grouped"
              groupedPosition={currentPosition}
              transactions={relevantTransactions}
              snapshotsByChain={snapshotsByChain}
              chainBlockData={actualBlockData}
            />
          </div>
        )}

        {/* Tabs Section - show when we have position or still loading */}
        {(currentPosition || isLoading) && (
          <Tabs
            value={selectedTab}
            onValueChange={(value) => setSelectedTab(value as PositionDetailTab)}
            className="mt-6 w-full"
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Loading skeleton for tab content */}
            {isLoading && !currentPosition && (
              <div className="space-y-6 mt-4">
                <div className="h-12 w-full animate-pulse rounded bg-hovered" />
                <div className="h-[300px] w-full animate-pulse rounded bg-hovered" />
              </div>
            )}

            {currentPosition && (
              <>
                <TabsContent value="overview">
                  <OverviewTab
                    groupedPosition={currentPosition}
                    chainId={chainId as SupportedNetworks}
                    isEarningsLoading={isEarningsLoading}
                    actualBlockData={actualBlockData}
                    period={period}
                    onPeriodChange={setPeriod}
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
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}
