'use client';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDisclosure, Tooltip } from '@heroui/react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { Chain } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { CgCompress } from "react-icons/cg";
import { FiSettings } from 'react-icons/fi';
import { RiExpandHorizontalLine } from 'react-icons/ri';

import { Button } from '@/components/common';
import { SuppliedAssetFilterCompactSwitch } from '@/components/common/SuppliedAssetFilterCompactSwitch';
import Header from '@/components/layout/header/Header';
import { useTokens } from '@/components/providers/TokenProvider';
import TrustedVaultsModal from '@/components/settings/TrustedVaultsModal';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModalV2 } from '@/components/SupplyModalV2';
import { TooltipContent } from '@/components/TooltipContent';
import { DEFAULT_MIN_SUPPLY_USD, DEFAULT_MIN_LIQUIDITY_USD } from '@/constants/markets';
import { defaultTrustedVaults, getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarkets } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { useStaredMarkets } from '@/hooks/useStaredMarkets';
import { useStyledToast } from '@/hooks/useStyledToast';
import { filterMarkets, sortMarkets, createPropertySort, createStarredSort } from '@/utils/marketFilters';
import { parseNumericThreshold } from '@/utils/markets';
import { SupportedNetworks } from '@/utils/networks';
import { PriceFeedVendors } from '@/utils/oracle';
import * as keys from '@/utils/storageKeys';
import { ERC20Token, UnknownERC20Token } from '@/utils/tokens';
import { Market } from '@/utils/types';

import AdvancedSearchBar, { ShortcutType } from './AdvancedSearchBar';
import AssetFilter from './AssetFilter';
import { DEFAULT_COLUMN_VISIBILITY, ColumnVisibility } from './columnVisibility';
import { SortColumn } from './constants';
import MarketSettingsModal from './MarketSettingsModal';
import MarketsTable from './marketsTable';
import NetworkFilter from './NetworkFilter';
import OracleFilter from './OracleFilter';

type MarketContentProps = {
  initialNetwork: SupportedNetworks | null;
  initialCollaterals: string[];
  initialLoanAssets: string[];
};

export default function Markets({
  initialNetwork,
  initialCollaterals,
  initialLoanAssets,
}: MarketContentProps) {
  const router = useRouter();

  const toast = useStyledToast();

  const {
    loading,
    markets: rawMarkets,
    refetch,
    isRefetching,
    showUnwhitelistedMarkets,
    setShowUnwhitelistedMarkets,
    addBlacklistedMarket: addBlacklistedMarketBase,
    isBlacklisted,
  } = useMarkets();
  const { staredIds, starMarket, unstarMarket } = useStaredMarkets();

  // Use addBlacklistedMarket directly from context
  // The context automatically reapplies the filter when blacklist changes
  const addBlacklistedMarket = addBlacklistedMarketBase;

  const {
    isOpen: isSettingsModalOpen,
    onOpen: onSettingsModalOpen,
    onOpenChange: onSettingsModalOpenChange,
  } = useDisclosure();

  // Initialize state with server-parsed values
  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>(initialCollaterals);
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<string[]>(initialLoanAssets);
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(initialNetwork);

  const [uniqueCollaterals, setUniqueCollaterals] = useState<(ERC20Token | UnknownERC20Token)[]>(
    [],
  );
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<(ERC20Token | UnknownERC20Token)[]>([]);

  const [sortColumn, setSortColumn] = useLocalStorage(keys.MarketSortColumnKey, SortColumn.Supply);
  const [sortDirection, setSortDirection] = useLocalStorage(keys.MarketSortDirectionKey, -1);

  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | undefined>(undefined);

  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedOracles, setSelectedOracles] = useState<PriceFeedVendors[]>([]);

  const { currentPage, setCurrentPage, entriesPerPage, handleEntriesPerPageChange, resetPage } =
    usePagination();

  const [includeUnknownTokens, setIncludeUnknownTokens] = useLocalStorage(
    keys.MarketsShowUnknownTokens,
    false,
  );
  const [showUnknownOracle, setShowUnknownOracle] = useLocalStorage(keys.MarketsShowUnknownOracle, false);

  const { allTokens, findToken } = useTokens();

  // USD Filter values
  const [usdMinSupply, setUsdMinSupply] = useLocalStorage(
    keys.MarketsUsdMinSupplyKey,
    DEFAULT_MIN_SUPPLY_USD.toString(),
  );
  const [usdMinBorrow, setUsdMinBorrow] = useLocalStorage(keys.MarketsUsdMinBorrowKey, '');
  const [usdMinLiquidity, setUsdMinLiquidity] = useLocalStorage(
    keys.MarketsUsdMinLiquidityKey,
    DEFAULT_MIN_LIQUIDITY_USD.toString(),
  );

  // USD Filter enabled states
  const [minSupplyEnabled, setMinSupplyEnabled] = useLocalStorage(
    keys.MarketsMinSupplyEnabledKey,
    true, // Default to enabled for backward compatibility
  );
  const [minBorrowEnabled, setMinBorrowEnabled] = useLocalStorage(
    keys.MarketsMinBorrowEnabledKey,
    false,
  );
  const [minLiquidityEnabled, setMinLiquidityEnabled] = useLocalStorage(
    keys.MarketsMinLiquidityEnabledKey,
    false,
  );

  const [trustedVaultsOnly, setTrustedVaultsOnly] = useLocalStorage(
    keys.MarketsTrustedVaultsOnlyKey,
    false,
  );

  // Column visibility state
  const [columnVisibilityState, setColumnVisibilityState] = useLocalStorage<ColumnVisibility>(
    keys.MarketsColumnVisibilityKey,
    DEFAULT_COLUMN_VISIBILITY,
  );

  const columnVisibility = useMemo(
    () => ({ ...DEFAULT_COLUMN_VISIBILITY, ...columnVisibilityState }),
    [columnVisibilityState],
  );

  const setColumnVisibility = useCallback(
    (visibility: ColumnVisibility) => {
      setColumnVisibilityState({ ...DEFAULT_COLUMN_VISIBILITY, ...visibility });
    },
    [setColumnVisibilityState],
  );

  // Table view mode: 'compact' (scrollable) or 'expanded' (full width)
  const [tableViewMode, setTableViewMode] = useLocalStorage<'compact' | 'expanded'>(
    keys.MarketsTableViewModeKey,
    'compact',
  );

  const [userTrustedVaults, setUserTrustedVaults] = useLocalStorage<TrustedVault[]>(
    'userTrustedVaults',
    defaultTrustedVaults,
  );
  const [isTrustedVaultsModalOpen, setIsTrustedVaultsModalOpen] = useState(false);

  const trustedVaultKeys = useMemo(() => {
    return new Set(
      userTrustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)),
    );
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

  const setUsdFilters = useCallback(
    (filters: { minSupply: string; minBorrow: string; minLiquidity: string }) => {
      setUsdMinSupply(filters.minSupply);
      setUsdMinBorrow(filters.minBorrow);
      setUsdMinLiquidity(filters.minLiquidity);
    },
    [setUsdMinSupply, setUsdMinBorrow, setUsdMinLiquidity],
  );

  const effectiveMinSupply = parseNumericThreshold(usdFilters.minSupply);
  const effectiveMinBorrow = parseNumericThreshold(usdFilters.minBorrow);
  const effectiveMinLiquidity = parseNumericThreshold(usdFilters.minLiquidity);

  useEffect(() => {
    // return if no markets
    if (!rawMarkets) return;

    const processTokens = (
      tokenInfoList: { address: string; chainId: number; symbol: string; decimals: number }[],
    ) => {
      if (!includeUnknownTokens) return allTokens;

      // Process unknown tokens
      const unknownTokensBySymbol = tokenInfoList.reduce(
        (acc, token) => {
          if (
            !allTokens.some((known) =>
              known.networks.some(
                (n) =>
                  n.address.toLowerCase() === token.address.toLowerCase() &&
                  n.chain.id === token.chainId,
              ),
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
        minSupply: { enabled: minSupplyEnabled, threshold: usdFilters.minSupply },
        minBorrow: { enabled: minBorrowEnabled, threshold: usdFilters.minBorrow },
        minLiquidity: { enabled: minLiquidityEnabled, threshold: usdFilters.minLiquidity },
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
      sorted = sortMarkets(filtered, createStarredSort(staredIds), 1);
    } else if (sortColumn === SortColumn.TrustedBy) {
      sorted = sortMarkets(
        filtered,
        (a, b) => Number(hasTrustedVault(a)) - Number(hasTrustedVault(b)),
        sortDirection as 1 | -1,
      );
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
      };
      const propertyPath = sortPropertyMap[sortColumn];
      if (propertyPath) {
        sorted = sortMarkets(filtered, createPropertySort(propertyPath), sortDirection as 1 | -1);
      } else {
        sorted = filtered;
      }
    }

    setFilteredMarkets(sorted);
    resetPage();
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
    staredIds,
    findToken,
    usdFilters,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
    trustedVaultsOnly,
    searchQuery,
    resetPage,
    hasTrustedVault,
  ]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  const titleOnclick = useCallback(
    (column: number) => {
      // Validate that column is a valid SortColumn value
      const isValidColumn = Object.values(SortColumn).includes(column);
      if (!isValidColumn) {
        console.error(`Invalid sort column value: ${column}`);
        return;
      }

      setSortColumn(column);

      if (column === sortColumn) {
        setSortDirection(-sortDirection);
      }
    },
    [sortColumn, sortDirection, setSortColumn, setSortDirection],
  );

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

  const handleMarketClick = (market: Market) => {
    // Build URL with current state instead of searchParams
    const params = new URLSearchParams();
    if (selectedCollaterals.length > 0) {
      params.set('collaterals', selectedCollaterals.join(','));
    }
    if (selectedLoanAssets.length > 0) {
      params.set('loanAssets', selectedLoanAssets.join(','));
    }
    if (selectedNetwork) {
      params.set('network', selectedNetwork.toString());
    }

    const marketPath = `/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`;
    const targetPath = params.toString() ? `${marketPath}?${params.toString()}` : marketPath;
    window.open(targetPath, '_blank');
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

        {showSupplyModal && selectedMarket && (
          <SupplyModalV2 market={selectedMarket} onClose={() => setShowSupplyModal(false)} />
        )}

        <MarketSettingsModal
          isOpen={isSettingsModalOpen}
          onOpenChange={onSettingsModalOpenChange}
          usdFilters={usdFilters}
          setUsdFilters={setUsdFilters}
          entriesPerPage={entriesPerPage}
          onEntriesPerPageChange={handleEntriesPerPageChange}
          columnVisibility={columnVisibility}
          setColumnVisibility={setColumnVisibility}
          onOpenTrustedVaultsModal={() => setIsTrustedVaultsModalOpen(true)}
          trustedVaults={userTrustedVaults}
        />

        <div className="flex items-center justify-between pb-4">
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

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row">
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

          {/* Settings */}
          <div className="mt-4 flex items-center gap-2 lg:mt-0">
            <SuppliedAssetFilterCompactSwitch
              includeUnknownTokens={includeUnknownTokens}
              setIncludeUnknownTokens={setIncludeUnknownTokens}
              showUnknownOracle={showUnknownOracle}
              setShowUnknownOracle={setShowUnknownOracle}
              showUnwhitelistedMarkets={showUnwhitelistedMarkets}
              setShowUnwhitelistedMarkets={setShowUnwhitelistedMarkets}
              trustedVaultsOnly={trustedVaultsOnly}
              setTrustedVaultsOnly={setTrustedVaultsOnly}
              minSupplyEnabled={minSupplyEnabled}
              setMinSupplyEnabled={setMinSupplyEnabled}
              minBorrowEnabled={minBorrowEnabled}
              setMinBorrowEnabled={setMinBorrowEnabled}
              minLiquidityEnabled={minLiquidityEnabled}
              setMinLiquidityEnabled={setMinLiquidityEnabled}
              thresholds={{
                minSupply: effectiveMinSupply,
                minBorrow: effectiveMinBorrow,
                minLiquidity: effectiveMinLiquidity,
              }}
              onOpenSettings={onSettingsModalOpen}
            />

            <Tooltip
              classNames={{
                base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                content: 'p-0 m-0 bg-transparent shadow-sm border-none',
              }}
              content={<TooltipContent title="Refresh" detail="Fetch the latest market data" />}
            >
              <Button
                disabled={loading || isRefetching}
                variant="light"
                size="sm"
                className="text-secondary min-w-0 px-2"
                onPress={handleRefresh}
                isIconOnly
              >
                <ReloadIcon className={`${isRefetching ? 'animate-spin' : ''} h-3 w-3`} />
              </Button>
            </Tooltip>

            <Tooltip
              classNames={{
                base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                content: 'p-0 m-0 bg-transparent shadow-sm border-none',
              }}
              content={
                <TooltipContent
                  icon={
                    tableViewMode === 'compact' ? (
                      <RiExpandHorizontalLine size={14} />
                    ) : (
                      <CgCompress size={14} />
                    )
                  }
                  title={tableViewMode === 'compact' ? 'Expand Table' : 'Compact Table'}
                  detail={tableViewMode === 'compact' ? 'Expand table to full width, useful when more columns are enabled.' : 'Restore compact table view'}
                />
              }
            >
              <Button
                isIconOnly
                aria-label="Toggle table width"
                variant="light"
                size="sm"
                className="text-secondary min-w-0 px-2"
                onPress={() => setTableViewMode(tableViewMode === 'compact' ? 'expanded' : 'compact')}
              >
                {tableViewMode === 'compact' ? (
                  <RiExpandHorizontalLine size={16} />
                ) : (
                  <CgCompress size={16} />
                )}
              </Button>
            </Tooltip>

            <Tooltip
              classNames={{
                base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                content: 'p-0 m-0 bg-transparent shadow-sm border-none',
              }}
              content={<TooltipContent title="Preferences" detail="Adjust thresholds and columns" />}
            >
              <Button
                isIconOnly
                aria-label="Market Preferences"
                variant="light"
                size="sm"
                className="text-secondary min-w-0 px-2"
                onPress={onSettingsModalOpen}
              >
                <FiSettings size={12} />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Table Section - can expand beyond container in expanded mode */}
      <div className={tableViewMode === 'expanded' ? 'mt-4 px-[2%]' : 'container px-[4%] mt-4'}>

        {loading ? (
          <div className={tableViewMode === 'expanded' ? 'container px-[4%]' : 'w-full'}>
            <LoadingScreen
              message="Loading Morpho Blue Markets..."
              className="min-h-[300px] w-full"
            />
          </div>
        ) : rawMarkets == null ? (
          <div className="flex justify-center"> No data </div>
        ) : (
          <div className={tableViewMode === 'expanded' ? 'flex justify-center' : 'w-full'}>
            {filteredMarkets.length > 0 ? (
              <MarketsTable
                markets={filteredMarkets}
                titleOnclick={titleOnclick}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onMarketClick={handleMarketClick}
                staredIds={staredIds}
                starMarket={starMarket}
                unstarMarket={unstarMarket}
                currentPage={currentPage}
                entriesPerPage={entriesPerPage}
                setCurrentPage={setCurrentPage}
                setShowSupplyModal={setShowSupplyModal}
                setSelectedMarket={setSelectedMarket}
                columnVisibility={columnVisibility}
                trustedVaults={userTrustedVaults}
                className={tableViewMode === 'compact' ? 'w-full' : undefined}
                wrapperClassName={tableViewMode === 'compact' ? 'w-full' : undefined}
                tableClassName={tableViewMode === 'compact' ? 'w-full min-w-full' : undefined}
                addBlacklistedMarket={addBlacklistedMarket}
                isBlacklisted={isBlacklisted}
              />
            ) : (
              <EmptyScreen
                message="No markets found with the current filters"
                hint={
                  (selectedCollaterals.length > 0 || selectedLoanAssets.length > 0) &&
                  !includeUnknownTokens
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
      <TrustedVaultsModal
        isOpen={isTrustedVaultsModalOpen}
        onOpenChange={setIsTrustedVaultsModalOpen}
        userTrustedVaults={userTrustedVaults}
        setUserTrustedVaults={setUserTrustedVaults}
      />
    </>
    );
}
