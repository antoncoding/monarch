'use client';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDisclosure } from '@heroui/react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { Chain } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { FiSettings } from 'react-icons/fi';
import { Button } from '@/components/common';
import Header from '@/components/layout/header/Header';
import { useTokens } from '@/components/providers/TokenProvider';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModalV2 } from '@/components/SupplyModalV2';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarkets } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { useStaredMarkets } from '@/hooks/useStaredMarkets';
import { useStyledToast } from '@/hooks/useStyledToast';
import { SupportedNetworks } from '@/utils/networks';
import { PriceFeedVendors, parsePriceFeedVendors } from '@/utils/oracle';
import * as keys from '@/utils/storageKeys';
import { ERC20Token, UnknownERC20Token } from '@/utils/tokens';
import { Market } from '@/utils/types';

import AdvancedSearchBar, { ShortcutType } from './AdvancedSearchBar';
import AssetFilter from './AssetFilter';
import { SortColumn } from './constants';
import MarketSettingsModal from './MarketSettingsModal';
import MarketsTable from './marketsTable';
import NetworkFilter from './NetworkFilter';
import OracleFilter from './OracleFilter';
import { applyFilterAndSort } from './utils';

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

  const { loading, markets: rawMarkets, refetch, isRefetching } = useMarkets();
  const { staredIds, starMarket, unstarMarket } = useStaredMarkets();

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
    'includeUnknownTokens',
    false,
  );
  const [showUnknownOracle, setShowUnknownOracle] = useLocalStorage('showUnknownOracle', false);

  const { allTokens, findToken } = useTokens();

  const [usdMinSupply, setUsdMinSupply] = useLocalStorage(keys.MarketsUsdMinSupplyKey, '');
  const [usdMinBorrow, setUsdMinBorrow] = useLocalStorage(keys.MarketsUsdMinBorrowKey, '');

  // Create memoized usdFilters object from individual localStorage values to prevent re-renders
  const usdFilters = useMemo(
    () => ({
      minSupply: usdMinSupply,
      minBorrow: usdMinBorrow,
    }),
    [usdMinSupply, usdMinBorrow],
  );

  const setUsdFilters = useCallback(
    (filters: { minSupply: string; minBorrow: string }) => {
      setUsdMinSupply(filters.minSupply);
      setUsdMinBorrow(filters.minBorrow);
    },
    [setUsdMinSupply, setUsdMinBorrow],
  );

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

    const filtered = applyFilterAndSort(
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
    ).filter((market) => {
      if (!searchQuery) return true; // If no search query, show all markets
      const lowercaseQuery = searchQuery.toLowerCase();
      const { vendors } = parsePriceFeedVendors(market.oracle?.data, market.morphoBlue.chain.id);
      const vendorsName = vendors.join(',');
      return (
        market.uniqueKey.toLowerCase().includes(lowercaseQuery) ||
        market.collateralAsset.symbol.toLowerCase().includes(lowercaseQuery) ||
        market.loanAsset.symbol.toLowerCase().includes(lowercaseQuery) ||
        vendorsName.toLowerCase().includes(lowercaseQuery)
      );
    });
    setFilteredMarkets(filtered);
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
    searchQuery,
    resetPage,
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
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[5%]">
        <h1 className="py-8 font-zen"> Markets </h1>

        {showSupplyModal && selectedMarket && (
          <SupplyModalV2 market={selectedMarket} onClose={() => setShowSupplyModal(false)} />
        )}

        <MarketSettingsModal
          isOpen={isSettingsModalOpen}
          onOpenChange={onSettingsModalOpenChange}
          includeUnknownTokens={includeUnknownTokens}
          setIncludeUnknownTokens={setIncludeUnknownTokens}
          showUnknownOracle={showUnknownOracle}
          setShowUnknownOracle={setShowUnknownOracle}
          usdFilters={usdFilters}
          setUsdFilters={setUsdFilters}
          entriesPerPage={entriesPerPage}
          onEntriesPerPageChange={handleEntriesPerPageChange}
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

          <div className="mt-4 flex items-center justify-end gap-2 lg:mt-0">
            <Button
              disabled={loading || isRefetching}
              variant="light"
              size="sm"
              className="text-secondary"
              onPress={handleRefresh}
            >
              <ReloadIcon className={`${isRefetching ? 'animate-spin' : ''} mr-1 h-3 w-3`} />
              Refresh
            </Button>

            <Button
              isIconOnly
              aria-label="Market View Settings"
              variant="light"
              size="sm"
              className="text-secondary"
              onPress={onSettingsModalOpen}
            >
              <FiSettings size={14} />
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingScreen message="Loading Morpho Blue Markets..." />
        ) : rawMarkets == null ? (
          <div> No data </div>
        ) : (
          <div className="max-w-screen mt-4">
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
                    : 'Try adjusting your filters or search query to see more results.'
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
