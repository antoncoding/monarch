'use client';
import { useCallback, useEffect, useState, useMemo } from 'react';
import type { Chain } from 'viem';
import { useRouter } from 'next/navigation';

import Header from '@/components/layout/header/Header';
import { useTokens } from '@/components/providers/TokenProvider';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { getVaultKey } from '@/constants/vaults/known_vaults';
import { useMarkets } from '@/hooks/useMarkets';
import { useModal } from '@/hooks/useModal';
import { usePagination } from '@/hooks/usePagination';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { filterMarkets, sortMarkets, createPropertySort, createStarredSort } from '@/utils/marketFilters';
import { parseNumericThreshold } from '@/utils/markets';
import type { SupportedNetworks } from '@/utils/networks';
import type { PriceFeedVendors } from '@/utils/oracle';
import type { ERC20Token, UnknownERC20Token } from '@/utils/tokens';
import type { Market } from '@/utils/types';

import AdvancedSearchBar, { ShortcutType } from './components/advanced-search-bar';
import AssetFilter from './components/filters/asset-filter';
import { SortColumn } from './components/constants';
import MarketsTable from './components/table/markets-table';
import NetworkFilter from './components/filters/network-filter';
import OracleFilter from './components/filters/oracle-filter';

type MarketContentProps = {
  initialNetwork: SupportedNetworks | null;
  initialCollaterals: string[];
  initialLoanAssets: string[];
};

export default function Markets({ initialNetwork, initialCollaterals, initialLoanAssets }: MarketContentProps) {
  const router = useRouter();

  const toast = useStyledToast();

  const {
    loading,
    markets: rawMarkets,
    refetch,
    isRefetching,
    addBlacklistedMarket,
    isBlacklisted,
  } = useMarkets();

  // Initialize state with server-parsed values
  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>(initialCollaterals);
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<string[]>(initialLoanAssets);
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(initialNetwork);

  const [uniqueCollaterals, setUniqueCollaterals] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<(ERC20Token | UnknownERC20Token)[]>([]);

  // Market preferences from Zustand store
  const {
    sortColumn,
    sortDirection,
    includeUnknownTokens,
    showUnknownOracle,
    usdMinSupply,
    setUsdMinSupply,
    usdMinBorrow,
    setUsdMinBorrow,
    usdMinLiquidity,
    setUsdMinLiquidity,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
    trustedVaultsOnly,
    starredMarkets,
  } = useMarketPreferences();

  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedOracles, setSelectedOracles] = useState<PriceFeedVendors[]>([]);

  const { currentPage, setCurrentPage, resetPage } = usePagination();

  const { allTokens, findToken } = useTokens();

  const { tableViewMode } = useMarketPreferences();

  // Force compact mode on mobile - track window size
  const [isMobile, setIsMobile] = useState(false);

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

  const { vaults: userTrustedVaults } = useTrustedVaults();
  const { open: openModal } = useModal();

  const trustedVaultKeys = useMemo(() => {
    return new Set(userTrustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)));
  }, [userTrustedVaults]);

  const hasTrustedVault = useCallback(
    (market: Market) => {
      if (!market.supplyingVaults?.length) return false;
      const chainId = market.morphoBlue.chain.id;
      return market.supplyingVaults.some((vault) => {
        if (!vault.address) return false;
        return trustedVaultKeys.has(getVaultKey(vault.address as string, chainId));
      });
    },
    [trustedVaultKeys],
  );

  // Create memoized usdFilters object from individual localStorage values to prevent re-renders
  const usdFilters = useMemo(
    () => ({
      minSupply: usdMinSupply,
      minBorrow: usdMinBorrow,
      minLiquidity: usdMinLiquidity,
    }),
    [usdMinSupply, usdMinBorrow, usdMinLiquidity],
  );

  const _setUsdFilters = useCallback(
    (filters: { minSupply: string; minBorrow: string; minLiquidity: string }) => {
      setUsdMinSupply(filters.minSupply);
      setUsdMinBorrow(filters.minBorrow);
      setUsdMinLiquidity(filters.minLiquidity);
    },
    [setUsdMinSupply, setUsdMinBorrow, setUsdMinLiquidity],
  );

  const _effectiveMinSupply = parseNumericThreshold(usdFilters.minSupply);
  const _effectiveMinBorrow = parseNumericThreshold(usdFilters.minBorrow);
  const _effectiveMinLiquidity = parseNumericThreshold(usdFilters.minLiquidity);

  useEffect(() => {
    // return if no markets
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

  const updateUrlParams = useCallback(
    (collaterals: string[], loanAssets: string[], network: SupportedNetworks | null) => {
      const params = new URLSearchParams();

      if (collaterals.length > 0) {
        params.set('collaterals', collaterals.join(','));
      }
      if (loanAssets.length > 0) {
        params.set('loanAssets', loanAssets.join(','));
      }
      if (network) {
        params.set('network', network.toString());
      }

      const newParams = params.toString();
      router.push(`?${newParams}`, { scroll: false });
    },
    [router],
  );

  const applyFiltersAndSort = useCallback(() => {
    if (!rawMarkets) return;

    // Apply filters using the new composable filtering system
    let filtered = filterMarkets(rawMarkets, {
      selectedNetwork,
      showUnknownTokens: includeUnknownTokens,
      showUnknownOracle,
      selectedCollaterals,
      selectedLoanAssets,
      selectedOracles,
      usdFilters: {
        minSupply: {
          enabled: minSupplyEnabled,
          threshold: usdFilters.minSupply,
        },
        minBorrow: {
          enabled: minBorrowEnabled,
          threshold: usdFilters.minBorrow,
        },
        minLiquidity: {
          enabled: minLiquidityEnabled,
          threshold: usdFilters.minLiquidity,
        },
      },
      findToken,
      searchQuery,
    });

    if (trustedVaultsOnly) {
      filtered = filtered.filter(hasTrustedVault);
    }

    // Apply sorting
    let sorted: Market[];
    if (sortColumn === SortColumn.Starred) {
      sorted = sortMarkets(filtered, createStarredSort(starredMarkets), 1);
    } else if (sortColumn === SortColumn.TrustedBy) {
      sorted = sortMarkets(filtered, (a, b) => Number(hasTrustedVault(a)) - Number(hasTrustedVault(b)), sortDirection as 1 | -1);
    } else {
      const sortPropertyMap: Record<SortColumn, string> = {
        [SortColumn.Starred]: 'uniqueKey',
        [SortColumn.LoanAsset]: 'loanAsset.name',
        [SortColumn.CollateralAsset]: 'collateralAsset.name',
        [SortColumn.LLTV]: 'lltv',
        [SortColumn.Supply]: 'state.supplyAssetsUsd',
        [SortColumn.Borrow]: 'state.borrowAssetsUsd',
        [SortColumn.SupplyAPY]: 'state.supplyApy',
        [SortColumn.Liquidity]: 'state.liquidityAssets',
        [SortColumn.BorrowAPY]: 'state.borrowApy',
        [SortColumn.RateAtTarget]: 'state.apyAtTarget',
        [SortColumn.TrustedBy]: '',
        [SortColumn.UtilizationRate]: 'state.utilization',
      };
      const propertyPath = sortPropertyMap[sortColumn];
      if (propertyPath) {
        sorted = sortMarkets(filtered, createPropertySort(propertyPath), sortDirection as 1 | -1);
      } else {
        sorted = filtered;
      }
    }

    setFilteredMarkets(sorted);
  }, [
    rawMarkets,
    sortColumn,
    sortDirection,
    selectedNetwork,
    includeUnknownTokens,
    showUnknownOracle,
    selectedCollaterals,
    selectedLoanAssets,
    selectedOracles,
    starredMarkets,
    findToken,
    usdFilters,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
    trustedVaultsOnly,
    searchQuery,
    hasTrustedVault,
  ]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  // Reset page only when filters change (not when sorting or starring changes)
  useEffect(() => {
    resetPage();
  }, [
    selectedNetwork,
    includeUnknownTokens,
    showUnknownOracle,
    selectedCollaterals,
    selectedLoanAssets,
    selectedOracles,
    usdFilters,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
    trustedVaultsOnly,
    searchQuery,
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // We don't need to call applyFiltersAndSort here, as it will be triggered by the useEffect
  };

  const handleFilterUpdate = (type: ShortcutType, tokens: string[]) => {
    // remove duplicates
    const uniqueTokens = [...new Set(tokens)];

    if (type === ShortcutType.Collateral) {
      setSelectedCollaterals(uniqueTokens);
    } else {
      setSelectedLoanAssets(uniqueTokens);
    }
    // We don't need to call applyFiltersAndSort here, as it will be triggered by the useEffect
  };

  const handleRefresh = () => {
    refetch(() => toast.success('Markets refreshed', 'Markets refreshed successfully'));
  };

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
              searchQuery={searchQuery}
              onSearch={handleSearch}
              onFilterUpdate={handleFilterUpdate}
              selectedCollaterals={selectedCollaterals}
              selectedLoanAssets={selectedLoanAssets}
              uniqueCollaterals={uniqueCollaterals}
              uniqueLoanAssets={uniqueLoanAssets}
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row">
              <NetworkFilter
                selectedNetwork={selectedNetwork}
                setSelectedNetwork={(network) => {
                  setSelectedNetwork(network);
                  updateUrlParams(selectedCollaterals, selectedLoanAssets, network);
                }}
              />

              <AssetFilter
                label="Loan Asset"
                placeholder="All loan asset"
                selectedAssets={selectedLoanAssets}
                setSelectedAssets={(assets) => {
                  setSelectedLoanAssets(assets);
                  updateUrlParams(selectedCollaterals, assets, selectedNetwork);
                }}
                items={uniqueLoanAssets}
                loading={loading}
                updateFromSearch={searchQuery.match(/loan:(\w+)/)?.[1]?.split(',')}
              />

              <AssetFilter
                label="Collateral"
                placeholder="All collateral"
                selectedAssets={selectedCollaterals}
                setSelectedAssets={(assets) => {
                  setSelectedCollaterals(assets);
                  updateUrlParams(assets, selectedLoanAssets, selectedNetwork);
                }}
                items={uniqueCollaterals}
                loading={loading}
                updateFromSearch={searchQuery.match(/collateral:(\w+)/)?.[1]?.split(',')}
              />

              <OracleFilter
                selectedOracles={selectedOracles}
                setSelectedOracles={setSelectedOracles}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table Section - centered when expanded, full width when compact */}
      <div className={effectiveTableViewMode === 'expanded' ? 'mt-4 px-[2%]' : 'container px-[4%] mt-4'}>
        {loading ? (
          <div className={effectiveTableViewMode === 'expanded' ? 'container px-[4%]' : 'w-full'}>
            <LoadingScreen
              message="Loading Morpho Blue Markets..."
              className="min-h-[300px] w-full"
            />
          </div>
        ) : rawMarkets == null ? (
          <div className="flex justify-center"> No data </div>
        ) : (
          <div className={effectiveTableViewMode === 'expanded' ? 'flex justify-center' : 'w-full'}>
            {filteredMarkets.length > 0 ? (
              <MarketsTable
                markets={filteredMarkets}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                trustedVaults={userTrustedVaults}
                className={effectiveTableViewMode === 'compact' ? 'w-full' : undefined}
                tableClassName={effectiveTableViewMode === 'compact' ? 'w-full min-w-full' : undefined}
                addBlacklistedMarket={addBlacklistedMarket}
                isBlacklisted={isBlacklisted}
                onOpenSettings={() => openModal('marketSettings', {})}
                onRefresh={handleRefresh}
                isRefetching={isRefetching}
                isMobile={isMobile}
              />
            ) : (
              <EmptyScreen
                message="No markets found with the current filters"
                hint={
                  (selectedCollaterals.length > 0 || selectedLoanAssets.length > 0) && !includeUnknownTokens
                    ? "Try enabling 'Show Unknown Tokens' in settings, or adjust your current filters."
                    : selectedOracles.length > 0 && !showUnknownOracle
                      ? "Try enabling 'Show Unknown Oracles' in settings, or adjust your oracle filters."
                      : trustedVaultsOnly
                        ? 'Disable the Trusted Vaults filter or update your trusted list in Settings.'
                        : minSupplyEnabled || minBorrowEnabled || minLiquidityEnabled
                          ? 'Try disabling USD filters in settings, or adjust your filter thresholds.'
                          : 'Try adjusting your filters or search query to see more results.'
                }
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
