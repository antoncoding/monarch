'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronDownIcon, Pencil2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchMonarchPortfolioPositionMarketsForNetworks } from '@/data-sources/monarch-api';
import type { UserVaultV2 } from '@/data-sources/monarch-api/vaults';
import { PositionBreadcrumbs } from '@/features/position-detail/components/position-breadcrumbs';
import { BorrowedMorphoBlueTable } from '@/features/positions/components/borrowed-morpho-blue-table';
import { PortfolioAnalyticsBanner } from '@/features/positions/components/portfolio-analytics-banner';
import { SuppliedMorphoBlueGroupedTable } from '@/features/positions/components/supplied-morpho-blue-grouped-table';
import { UserVaultsTable } from '@/features/positions/components/user-vaults-table';
import { useUserVaultsV2Query } from '@/hooks/queries/useUserVaultsV2Query';
import { usePortfolioValue } from '@/hooks/usePortfolioValue';
import { useRateLabel } from '@/hooks/useRateLabel';
import useUserPositionsSummaryData, { type EarningsTimeRange } from '@/hooks/useUserPositionsSummaryData';
import { useVaultHistoricalApy } from '@/hooks/useVaultHistoricalApy';
import { useAppSettings } from '@/stores/useAppSettings';
import { useLocalPortfolios } from '@/stores/useLocalPortfolios';
import { usePositionsFilters } from '@/stores/usePositionsFilters';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import { hasSupplyPositionHistory, type PositionSnapshot } from '@/utils/positions';
import type { MarketPositionWithEarnings } from '@/utils/types';
import { useModal } from '@/hooks/useModal';

type AccountPosition = MarketPositionWithEarnings & { account: Address };
type AccountVault = UserVaultV2 & { account: Address };

type AccountResult = {
  positions: AccountPosition[];
  vaults: AccountVault[];
  loading: boolean;
  earningsLoading: boolean;
  vaultsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  earningsRangesByChain: Record<number, EarningsTimeRange>;
};

function PortfolioAccountLoader({
  account,
  marketHints,
  sourceMarketKeysProvided,
  period,
  onChange,
}: {
  account: Address;
  marketHints: Array<{
    marketUniqueKey: string;
    chainId: number;
    hasSupplyHistory?: boolean;
    supplyHistory?: AccountPosition['supplyHistory'];
  }>;
  sourceMarketKeysProvided: boolean;
  period: ReturnType<typeof usePositionsFilters.getState>['period'];
  onChange: (account: Address, result: AccountResult) => void;
}) {
  const summary = useUserPositionsSummaryData(account, period, undefined, {
    marketHints,
    sourceMarketKeysProvided,
  });
  const vaultsQuery = useUserVaultsV2Query({ userAddress: account });
  const vaults = vaultsQuery.data ?? [];
  const vaultApyQuery = useVaultHistoricalApy(vaults, period);

  const positionsWithAccount = useMemo(() => summary.positions.map((position) => ({ ...position, account })), [account, summary.positions]);
  const vaultsWithAccount = useMemo(
    () =>
      vaults.map((vault) => {
        const periodData = vaultApyQuery.data?.get(vault.address.toLowerCase());
        return {
          ...vault,
          account,
          actualApy: periodData?.actualApy,
          earnedAssets: periodData?.earnedAssets,
          earningsPeriodSeconds: periodData?.periodSeconds,
        };
      }),
    [account, vaultApyQuery.data, vaults],
  );

  const resultSignature = [
    summary.isPositionsLoading,
    summary.isEarningsLoading,
    vaultApyQuery.isLoading,
    vaultsQuery.isLoading,
    ...positionsWithAccount.map(
      (position) =>
        `${position.market.morphoBlue.chain.id}:${position.market.uniqueKey}:${position.state.supplyAssets}:${position.state.borrowAssets}:${position.state.collateral}:${position.market.state.supplyApy ?? ''}:${position.market.state.borrowApy ?? ''}:${position.oraclePrice ?? ''}:${position.earned}:${position.actualApy}`,
    ),
    ...vaultsWithAccount.map(
      (vault) =>
        `${vault.networkId}:${vault.address}:${vault.balance?.toString() ?? ''}:${vault.actualApy ?? ''}:${vault.earnedAssets?.toString() ?? ''}`,
    ),
    ...Object.entries(summary.actualBlockData).map(([chainId, block]) => `${chainId}:${block.block}:${block.timestamp}`),
  ].join('|');
  const previousResultSignature = useRef('');
  const currentResult = useRef<AccountResult | null>(null);
  currentResult.current = {
    positions: positionsWithAccount,
    vaults: vaultsWithAccount,
    loading: summary.isPositionsLoading,
    earningsLoading: summary.isEarningsLoading || vaultApyQuery.isLoading,
    vaultsLoading: vaultsQuery.isLoading,
    actualBlockData: summary.actualBlockData,
    snapshotsByChain: summary.snapshotsByChain,
    earningsRangesByChain: summary.earningsRangesByChain,
  };

  // Summary hooks derive new container objects while background queries settle. Only publish
  // domain changes so the invisible loader cannot create a parent/child update loop.
  useEffect(() => {
    if (previousResultSignature.current === resultSignature) return;
    previousResultSignature.current = resultSignature;
    if (currentResult.current) onChange(account, currentResult.current);
  }, [account, onChange, resultSignature]);

  return null;
}

export default function PortfolioView() {
  const { portfolio: portfolioRoute } = useParams<{ portfolio: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const portfolios = useLocalPortfolios((state) => state.portfolios);
  const { open } = useModal();
  const period = usePositionsFilters((state) => state.period);
  const setPeriod = usePositionsFilters((state) => state.setPeriod);
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const [results, setResults] = useState<Record<string, AccountResult>>({});
  const portfolio = portfolios.find((entry) => entry.slug === portfolioRoute || entry.id === portfolioRoute);
  const accounts = useMemo(() => portfolio?.accounts ?? [], [portfolio?.accounts]);
  const accountsSignature = accounts
    .map((account) => account.toLowerCase())
    .sort()
    .join(',');

  useEffect(() => {
    if (!portfolio || portfolio.slug === portfolioRoute) return;
    router.replace(`/portfolios/${portfolio.slug}`);
  }, [portfolio, portfolioRoute, router]);

  const positionMarketsQuery = useQuery({
    queryKey: ['portfolio-position-markets', accountsSignature],
    queryFn: () => fetchMonarchPortfolioPositionMarketsForNetworks(accounts, ALL_SUPPORTED_NETWORKS),
    enabled: accounts.length > 0,
    staleTime: 30_000,
  });

  const hintsByAccount = useMemo(() => {
    const grouped = new Map<string, NonNullable<typeof positionMarketsQuery.data>>();
    for (const market of positionMarketsQuery.data ?? []) {
      const existing = grouped.get(market.account) ?? [];
      existing.push(market);
      grouped.set(market.account, existing);
    }
    return grouped;
  }, [positionMarketsQuery.data]);

  const handleAccountResult = useCallback((account: Address, result: AccountResult) => {
    setResults((current) => ({ ...current, [account.toLowerCase()]: result }));
  }, []);

  useEffect(() => {
    const activeAccounts = new Set(accounts.map((account) => account.toLowerCase()));
    setResults((current) => Object.fromEntries(Object.entries(current).filter(([account]) => activeAccounts.has(account))));
  }, [accountsSignature]);

  const accountResults = accounts
    .map((account) => results[account.toLowerCase()])
    .filter((result): result is AccountResult => Boolean(result));
  const positions = accountResults.flatMap((result) => result.positions);
  const vaults = accountResults.flatMap((result) => result.vaults);
  const loading =
    positionMarketsQuery.isLoading || accountResults.length < accounts.length || accountResults.some((result) => result.loading);
  const isEarningsLoading = accountResults.some((result) => result.earningsLoading);
  const isVaultsLoading = accountResults.some((result) => result.vaultsLoading);
  const actualBlockData = Object.assign({}, ...accountResults.map((result) => result.actualBlockData));
  const earningsRangesByChain = Object.assign({}, ...accountResults.map((result) => result.earningsRangesByChain));
  const snapshotsByAccount = Object.fromEntries(
    accounts.map((account) => [account.toLowerCase(), results[account.toLowerCase()]?.snapshotsByChain ?? {}]),
  );
  const snapshotsByChain = accountResults[0]?.snapshotsByChain ?? {};

  const {
    totalUsd,
    totalDebtUsd,
    assetBreakdown,
    debtBreakdown,
    portfolioAnalytics,
    isLoading: isPricesLoading,
    error: pricesError,
  } = usePortfolioValue(positions, vaults, earningsRangesByChain);

  const hasSuppliedMarkets = positions.some(hasSupplyPositionHistory);
  const hasBorrowPositions = positions.some(
    (position) => BigInt(position.state.borrowShares) > 0n || BigInt(position.state.collateral) > 0n,
  );
  const hasVaults = vaults.some((vault) => vault.balance && vault.balance > 0n);
  const showEmpty = !loading && !isVaultsLoading && !hasSuppliedMarkets && !hasBorrowPositions && !hasVaults;

  const handleRefetch = async (onSuccess?: () => void) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['portfolio-position-markets', accountsSignature] }),
      queryClient.invalidateQueries({ queryKey: ['positions'] }),
      queryClient.invalidateQueries({ queryKey: ['enhanced-positions'] }),
      queryClient.invalidateQueries({ queryKey: ['user-vaults-v2'] }),
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] }),
    ]);
    onSuccess?.();
  };

  if (!portfolio) {
    return (
      <div className="flex flex-col justify-between font-zen">
        <Header />
        <div className="container mt-10">
          <EmptyScreen message="Portfolio not found in this browser." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full pb-20">
        <div className="mt-6 flex min-h-10 items-center gap-2">
          <PositionBreadcrumbs
            showPosition={false}
            rootLabel="Portfolios"
            rootHref="/portfolios"
          />
          <span className="text-secondary">/</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 px-2 text-secondary"
              >
                {portfolio.name}
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {portfolios.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onClick={() => router.push(`/portfolios/${entry.slug}`)}
                >
                  {entry.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => open('createPortfolio', { onCreated: (slug) => router.push(`/portfolios/${slug}`) })}
                startContent={<PlusIcon />}
              >
                Create new portfolio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {accounts.length === 0 ? (
          <EmptyScreen
            message="This portfolio has no accounts yet."
            hint="Choose accounts from your viewing history."
            className="mt-10"
            action={
              <Button
                variant="primary"
                size="md"
                onClick={() => open('editPortfolio', { portfolioId: portfolio.id })}
              >
                <Pencil2Icon />
                Edit portfolio
              </Button>
            }
          />
        ) : (
          <>
            {accounts.map((account) => (
              <PortfolioAccountLoader
                key={account}
                account={account}
                marketHints={hintsByAccount.get(account.toLowerCase()) ?? []}
                sourceMarketKeysProvided={positionMarketsQuery.isSuccess}
                period={period}
                onChange={handleAccountResult}
              />
            ))}

            <div className="mt-3 pb-4">
              <PortfolioAnalyticsBanner
                account={accounts[0]}
                portfolioName={portfolio.name}
                portfolioAccounts={accounts}
                onEditPortfolio={() => open('editPortfolio', { portfolioId: portfolio.id })}
                period={period}
                onPeriodChange={setPeriod}
                rateLabel={rateLabel}
                isAprDisplay={isAprDisplay}
                totalUsd={totalUsd}
                totalDebtUsd={totalDebtUsd}
                assetBreakdown={assetBreakdown}
                debtBreakdown={debtBreakdown}
                portfolioAnalytics={portfolioAnalytics}
                isValueLoading={isPricesLoading}
                isEarningsLoading={isEarningsLoading}
                valueError={pricesError}
                showPortfolioStats={!loading}
              />
            </div>

            <div className="mt-2 space-y-6">
              {loading && (
                <LoadingScreen
                  message="Loading portfolio positions..."
                  className="mt-10"
                />
              )}
              {!loading && hasSuppliedMarkets && (
                <SuppliedMorphoBlueGroupedTable
                  account={accounts[0]}
                  positions={positions}
                  refetch={handleRefetch}
                  isRefetching={positionMarketsQuery.isFetching}
                  isEarningsLoading={isEarningsLoading}
                  actualBlockData={actualBlockData}
                  snapshotsByChain={snapshotsByChain}
                  snapshotsByAccount={snapshotsByAccount}
                  showAccount
                />
              )}
              {!loading && hasBorrowPositions && (
                <BorrowedMorphoBlueTable
                  account={accounts[0]}
                  positions={positions}
                  onRefetch={handleRefetch}
                  isRefetching={positionMarketsQuery.isFetching}
                  showAccount
                />
              )}
              {!isVaultsLoading && hasVaults && (
                <UserVaultsTable
                  vaults={vaults}
                  period={period}
                  isEarningsLoading={isEarningsLoading}
                  refetch={() => void handleRefetch()}
                  isRefetching={positionMarketsQuery.isFetching}
                  showAccount
                />
              )}
              {showEmpty && <EmptyScreen message="No open positions across these accounts." />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
