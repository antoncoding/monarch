'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { usePositionDetailPreferences, type PositionDetailTab } from '@/stores/usePositionDetailPreferences';
import { usePositionsFilters } from '@/stores/usePositionsFilters';
import { groupPositionsByLoanAsset, processCollaterals } from '@/utils/positions';
import type { SupportedNetworks } from '@/utils/networks';
import { PositionHeader } from './components/position-header';
import { OverviewTab } from './components/overview-tab';
import { ReportTab } from './components/report-tab';
import { HistoryTab } from './components/history-tab';

type PositionDetailContentProps = {
  chainId: number;
  loanAsset: string;
  userAddress: string;
};

export default function PositionDetailContent({ chainId, loanAsset, userAddress }: PositionDetailContentProps) {
  const router = useRouter();

  // Tab preferences
  const selectedTab = usePositionDetailPreferences((s) => s.selectedTab);
  const setSelectedTab = usePositionDetailPreferences((s) => s.setSelectedTab);

  // Period filter from positions store
  const period = usePositionsFilters((s) => s.period);

  // Data loading
  const { loading: isMarketsLoading } = useProcessedMarkets();
  const {
    positions: marketPositions,
    isPositionsLoading,
    isEarningsLoading,
    isRefetching,
    refetch,
    actualBlockData,
  } = useUserPositionsSummaryData(userAddress, period, [chainId as SupportedNetworks]);

  const loading = isMarketsLoading || isPositionsLoading;

  // Group and process positions
  const groupedPositions = useMemo(() => {
    const grouped = groupPositionsByLoanAsset(marketPositions);
    return processCollaterals(grouped);
  }, [marketPositions]);

  // Find the current position based on chainId and loanAsset
  const currentPosition = useMemo(() => {
    return groupedPositions.find(
      (pos) =>
        pos.chainId === chainId &&
        (pos.loanAssetSymbol.toLowerCase() === loanAsset.toLowerCase() || pos.loanAssetAddress.toLowerCase() === loanAsset.toLowerCase()),
    );
  }, [groupedPositions, chainId, loanAsset]);

  // Get all user positions for the position switcher (across all chains)
  const { positions: allUserPositions } = useUserPositionsSummaryData(userAddress, period);

  const allGroupedPositions = useMemo(() => {
    const grouped = groupPositionsByLoanAsset(allUserPositions);
    return processCollaterals(grouped);
  }, [allUserPositions]);

  // Handle refetch
  const handleRefetch = () => {
    refetch();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col justify-between font-zen">
        <Header />
        <div className="container h-full gap-8">
          <LoadingScreen
            message={isMarketsLoading ? 'Loading markets...' : 'Loading position...'}
            className="mt-10"
          />
        </div>
      </div>
    );
  }

  // No position found
  if (!currentPosition) {
    return (
      <div className="flex flex-col justify-between font-zen">
        <Header />
        <div className="container h-full gap-8">
          <EmptyScreen
            message={`No ${loanAsset} position found on this network.`}
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
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 pb-12">
        {/* Position Header */}
        <PositionHeader
          groupedPosition={currentPosition}
          chainId={chainId as SupportedNetworks}
          userAddress={userAddress}
          allPositions={allGroupedPositions}
          onRefetch={handleRefetch}
          isRefetching={isRefetching}
        />

        {/* Tabs Section */}
        <Tabs
          value={selectedTab}
          onValueChange={(value) => setSelectedTab(value as PositionDetailTab)}
          className="mt-8 w-full"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              groupedPosition={currentPosition}
              chainId={chainId as SupportedNetworks}
              isEarningsLoading={isEarningsLoading}
              actualBlockData={actualBlockData}
              period={period}
            />
          </TabsContent>

          <TabsContent value="report">
            <ReportTab
              groupedPosition={currentPosition}
              chainId={chainId as SupportedNetworks}
              userAddress={userAddress}
            />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab
              groupedPosition={currentPosition}
              chainId={chainId as SupportedNetworks}
              userAddress={userAddress}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
