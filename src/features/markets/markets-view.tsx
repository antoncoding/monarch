'use client';
import { useCallback, useEffect, useState, useMemo } from 'react';
import type { Chain } from 'viem';

import Header from '@/components/layout/header/Header';
import { useTokens } from '@/components/providers/TokenProvider';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useFilteredMarkets } from '@/hooks/useFilteredMarkets';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { useModal } from '@/hooks/useModal';
import { usePagination } from '@/hooks/usePagination';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import type { ERC20Token, UnknownERC20Token } from '@/utils/tokens';

import AdvancedSearchBar, { ShortcutType } from './components/advanced-search-bar';
import AssetFilter from './components/filters/asset-filter';
import MarketsTable from './components/table/markets-table';
import NetworkFilter from './components/filters/network-filter';
import OracleFilter from './components/filters/oracle-filter';

export default function Markets() {
  const toast = useStyledToast();

  // Data fetching with React Query
  const { data: rawMarkets, isLoading: loading, refetch } = useMarketsQuery();

  // Filter state (persisted to localStorage)
  const filters = useMarketsFilters();

  // Derived data (filtered + sorted markets)
  const filteredMarkets = useFilteredMarkets();

  // UI state
  const [uniqueCollaterals, setUniqueCollaterals] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Store hooks
  const { currentPage, setCurrentPage, resetPage } = usePagination();
  const { allTokens } = useTokens();
  const { tableViewMode, includeUnknownTokens } = useMarketPreferences();
  const { vaults: userTrustedVaults } = useTrustedVaults();
  const { open: openModal } = useModal();

  // Force compact mode on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Effective table view mode - always compact on mobile
  const effectiveTableViewMode = isMobile ? 'compact' : tableViewMode;

  // Compute unique collaterals and loan assets for filter dropdowns
  useEffect(() => {
    if (!rawMarkets) return;

    const processTokens = (
      tokenInfoList: {
        address: string;
        chainId: number;
        symbol: string;
        decimals: number;
      }[],
    ) => {
      if (!includeUnknownTokens) return allTokens;

      // Process unknown tokens
      const unknownTokensBySymbol = tokenInfoList.reduce(
        (acc, token) => {
          if (
            !allTokens.some((known) =>
              known.networks.some((n) => n.address.toLowerCase() === token.address.toLowerCase() && n.chain.id === token.chainId),
            )
          ) {
            if (!acc[token.symbol]) {
              acc[token.symbol] = {
                symbol: token.symbol.length > 10 ? `${token.symbol.slice(0, 10)}...` : token.symbol,
                img: undefined,
                decimals: token.decimals,
                networks: [],
                isUnknown: true,
                source: 'unknown',
              };
            }
            acc[token.symbol].networks.push({
              chain: { id: token.chainId } as Chain,
              address: token.address,
            });
          }
          return acc;
        },
        {} as Record<string, UnknownERC20Token>,
      );

      return [...allTokens, ...Object.values(unknownTokensBySymbol)];
    };

    const collatList = rawMarkets.map((m) => ({
      address: m.collateralAsset.address,
      chainId: m.morphoBlue.chain.id,
      symbol: m.collateralAsset.symbol,
      decimals: m.collateralAsset.decimals,
    }));

    const loanList = rawMarkets.map((m) => ({
      address: m.loanAsset.address,
      chainId: m.morphoBlue.chain.id,
      symbol: m.loanAsset.symbol,
      decimals: m.loanAsset.decimals,
    }));

    setUniqueCollaterals(processTokens(collatList));
    setUniqueLoanAssets(processTokens(loanList));
  }, [rawMarkets, includeUnknownTokens, allTokens]);

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [
    filters.selectedNetwork,
    filters.selectedCollaterals,
    filters.selectedLoanAssets,
    filters.selectedOracles,
    filters.searchQuery,
    resetPage,
  ]);

  // Add keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.getElementById('market-search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handlers
  const handleFilterUpdate = useCallback(
    (type: ShortcutType, tokens: string[]) => {
      const uniqueTokens = [...new Set(tokens)];
      if (type === ShortcutType.Collateral) {
        filters.setSelectedCollaterals(uniqueTokens);
      } else {
        filters.setSelectedLoanAssets(uniqueTokens);
      }
    },
    [filters],
  );

  const handleRefresh = useCallback(() => {
    refetch().then(() => toast.success('Markets refreshed', 'Markets refreshed successfully'));
  }, [refetch, toast]);

  return (
    <>
      <div className="flex w-full flex-col justify-between font-zen">
        <Header />
      </div>
      <div className="container h-full gap-8 px-[4%]">
        <h1 className="py-8 font-zen"> Markets </h1>

        <div className="flex flex-col gap-4 pb-4">
          <div className="w-full lg:w-1/2">
            <AdvancedSearchBar
              searchQuery={filters.searchQuery}
              onSearch={filters.setSearchQuery}
              onFilterUpdate={handleFilterUpdate}
              selectedCollaterals={filters.selectedCollaterals}
              selectedLoanAssets={filters.selectedLoanAssets}
              uniqueCollaterals={uniqueCollaterals}
              uniqueLoanAssets={uniqueLoanAssets}
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row">
              <NetworkFilter selectedNetwork={filters.selectedNetwork} setSelectedNetwork={filters.setSelectedNetwork} />

              <AssetFilter
                label="Loan Asset"
                placeholder="All loan asset"
                selectedAssets={filters.selectedLoanAssets}
                setSelectedAssets={filters.setSelectedLoanAssets}
                items={uniqueLoanAssets}
                loading={loading}
                updateFromSearch={filters.searchQuery.match(/loan:(\w+)/)?.[1]?.split(',')}
              />

              <AssetFilter
                label="Collateral"
                placeholder="All collateral"
                selectedAssets={filters.selectedCollaterals}
                setSelectedAssets={filters.setSelectedCollaterals}
                items={uniqueCollaterals}
                loading={loading}
                updateFromSearch={filters.searchQuery.match(/collateral:(\w+)/)?.[1]?.split(',')}
              />

              <OracleFilter selectedOracles={filters.selectedOracles} setSelectedOracles={filters.setSelectedOracles} />
            </div>
          </div>
        </div>
      </div>

      {/* Table Section - centered when expanded, full width when compact */}
      <div className={effectiveTableViewMode === 'expanded' ? 'mt-4 px-[2%]' : 'container px-[4%] mt-4'}>
        <div className={effectiveTableViewMode === 'expanded' ? 'flex justify-center' : 'w-full'}>
          <MarketsTable
            markets={filteredMarkets}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            trustedVaults={userTrustedVaults}
            className={effectiveTableViewMode === 'compact' ? 'w-full' : undefined}
            tableClassName={effectiveTableViewMode === 'compact' ? 'w-full min-w-full' : undefined}
            onOpenSettings={() => openModal('marketSettings', {})}
            onRefresh={handleRefresh}
            isMobile={isMobile}
          />
        </div>
      </div>
    </>
  );
}
