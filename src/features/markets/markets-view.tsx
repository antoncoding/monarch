'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Chain } from 'viem';

import Header from '@/components/layout/header/Header';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { usePagination } from '@/hooks/usePagination';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import type { ERC20Token, UnknownERC20Token } from '@/utils/tokens';

import { CompactFilterBar } from './components/filters/compact-filter-bar';
import MarketsTable from './components/table/markets-table';

export default function Markets() {
  const toast = useStyledToast();

  // Data fetching with React Query
  const { data: rawMarkets, isLoading: loading, refetch } = useMarketsQuery();

  const filters = useMarketsFilters();

  // UI state
  const [uniqueCollaterals, setUniqueCollaterals] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Store hooks
  const { currentPage, setCurrentPage, resetPage } = usePagination();
  const { allTokens } = useTokensQuery();
  const { tableViewMode, includeUnknownTokens } = useMarketPreferences();

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

  const handleRefresh = useCallback(() => {
    refetch().then(() => toast.success('Markets refreshed', 'Markets refreshed successfully'));
  }, [refetch, toast]);

  return (
    <>
      <div className="flex w-full flex-col justify-between font-zen">
        <Header />
      </div>
      <div className="container h-full gap-8">
        <h1 className="pt-12 pb-4 font-zen"> Markets </h1>

        <div className="pb-2 pt-2">
          <CompactFilterBar
            searchQuery={filters.searchQuery}
            onSearch={filters.setSearchQuery}
            selectedNetwork={filters.selectedNetwork}
            setSelectedNetwork={filters.setSelectedNetwork}
            selectedLoanAssets={filters.selectedLoanAssets}
            setSelectedLoanAssets={filters.setSelectedLoanAssets}
            loanAssetItems={uniqueLoanAssets}
            selectedCollaterals={filters.selectedCollaterals}
            setSelectedCollaterals={filters.setSelectedCollaterals}
            collateralItems={uniqueCollaterals}
            selectedOracles={filters.selectedOracles}
            setSelectedOracles={filters.setSelectedOracles}
            loading={loading}
            onClearAll={filters.resetFilters}
          />
        </div>
      </div>

      {/* Table Section - centered when expanded, full width when compact */}
      <div className={effectiveTableViewMode === 'expanded' ? 'mt-2 ' : 'container mt-2'}>
        <div className={effectiveTableViewMode === 'expanded' ? 'flex justify-center' : 'w-full'}>
          <MarketsTable
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            className={effectiveTableViewMode === 'compact' ? 'w-full' : undefined}
            tableClassName={effectiveTableViewMode === 'compact' ? 'w-full min-w-full' : undefined}
            onRefresh={handleRefresh}
            isMobile={isMobile}
          />
        </div>
      </div>
    </>
  );
}
