'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Chain } from 'viem';

import Header from '@/components/layout/header/Header';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { parseMarketFilterUrlState } from '@/features/markets/market-filter-url-state';
import { useFilteredMarkets } from '@/hooks/useFilteredMarkets';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useMarketFilterPreferences } from '@/stores/useMarketFilterPreferences';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { usePagination } from '@/hooks/usePagination';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import type { ERC20Token, UnknownERC20Token } from '@/utils/tokens';

import { CompactFilterBar } from './components/filters/compact-filter-bar';
import MarketsTable from './components/table/markets-table';

export default function Markets() {
  const toast = useStyledToast();
  const appliedUrlSignatureRef = useRef<string | null>(null);
  const [currentSearchParams, setCurrentSearchParams] = useState('');

  // Data fetching with React Query
  const { data: rawMarkets, isLoading: loading, refetch } = useMarketsQuery();
  const { markets, isLoading: filteredMarketsLoading, isWhitelistUnavailable } = useFilteredMarkets();

  const filters = useMarketsFilters();
  const persistedFilters = useMarketFilterPreferences();
  const urlFilterState = useMemo(() => parseMarketFilterUrlState(new URLSearchParams(currentSearchParams)), [currentSearchParams]);

  // UI state
  const [uniqueCollaterals, setUniqueCollaterals] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Store hooks
  const { currentPage, setCurrentPage, resetPage } = usePagination();
  const { allTokens } = useTokensQuery();
  const { tableViewMode, includeUnknownTokens } = useMarketPreferences();

  useLayoutEffect(() => {
    setCurrentSearchParams(window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search);
  }, []);

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
  const isLoadingTableState = loading || filteredMarketsLoading;
  const isTableFallbackState = !rawMarkets || markets.length === 0 || isWhitelistUnavailable;
  const shouldUseFullWidthTableLayout = isLoadingTableState || isTableFallbackState || effectiveTableViewMode === 'compact';

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

  useLayoutEffect(() => {
    if (!urlFilterState.signature) {
      appliedUrlSignatureRef.current = null;
      return;
    }

    if (appliedUrlSignatureRef.current === urlFilterState.signature) {
      return;
    }

    if (urlFilterState.selectedNetwork !== undefined && urlFilterState.selectedNetwork !== persistedFilters.selectedNetwork) {
      persistedFilters.applySelections({ selectedNetwork: urlFilterState.selectedNetwork });
    }

    appliedUrlSignatureRef.current = urlFilterState.signature;
  }, [persistedFilters, urlFilterState.selectedNetwork, urlFilterState.signature]);

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [
    persistedFilters.selectedNetwork,
    persistedFilters.selectedCollaterals,
    persistedFilters.selectedLoanAssets,
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

  const handleClearAll = useCallback(() => {
    persistedFilters.reset();
    filters.resetFilters();
  }, [filters, persistedFilters]);

  return (
    <>
      <div className="flex w-full flex-col justify-between font-zen">
        <Header />
      </div>
      <div className="container h-full gap-8">
        <div className="mt-6 min-h-10 flex items-center">
          <Breadcrumbs
            items={[
              { label: 'Market', href: '/markets' },
              { label: 'All Markets', isCurrent: true },
            ]}
          />
        </div>

        <div className="pb-2 pt-2">
          <CompactFilterBar
            searchQuery={filters.searchQuery}
            onSearch={filters.setSearchQuery}
            selectedNetwork={persistedFilters.selectedNetwork}
            setSelectedNetwork={persistedFilters.setSelectedNetwork}
            selectedLoanAssets={persistedFilters.selectedLoanAssets}
            setSelectedLoanAssets={persistedFilters.setSelectedLoanAssets}
            loanAssetItems={uniqueLoanAssets}
            selectedCollaterals={persistedFilters.selectedCollaterals}
            setSelectedCollaterals={persistedFilters.setSelectedCollaterals}
            collateralItems={uniqueCollaterals}
            selectedOracles={filters.selectedOracles}
            setSelectedOracles={filters.setSelectedOracles}
            loading={loading}
            onClearAll={handleClearAll}
          />
        </div>
      </div>

      {/* Table Section - force full width while loading, preserve expanded/compact behavior after load */}
      <div className={shouldUseFullWidthTableLayout ? 'container mt-2' : 'mt-2'}>
        <div className={shouldUseFullWidthTableLayout ? 'w-full' : 'flex justify-center'}>
          <MarketsTable
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            className={shouldUseFullWidthTableLayout ? 'w-full' : 'w-fit'}
            tableClassName={shouldUseFullWidthTableLayout ? 'w-full min-w-full' : 'w-fit'}
            onRefresh={handleRefresh}
            isMobile={isMobile}
          />
        </div>
      </div>
    </>
  );
}
