'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useDisclosure } from '@nextui-org/react';
import { Chain } from '@rainbow-me/rainbowkit';
import storage from 'local-storage-fallback';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSync } from 'react-icons/fa';
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
import { useStyledToast } from '@/hooks/useStyledToast';
import { SupportedNetworks } from '@/utils/networks';
import { OracleVendors, parseOracleVendors } from '@/utils/oracle';
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

const storedSortColumn = Number(
  storage.getItem(keys.MarketSortColumnKey) ?? SortColumn.Supply.toString(),
);

// Ensure the sort column is a valid value
const defaultSortColumn = Object.values(SortColumn).includes(storedSortColumn)
  ? storedSortColumn
  : SortColumn.Supply;

const defaultSortDirection = Number(storage.getItem(keys.MarketSortDirectionKey) ?? '-1');
const defaultStaredMarkets = JSON.parse(
  storage.getItem(keys.MarketFavoritesKey) ?? '[]',
) as string[];

export default function Markets() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toast = useStyledToast();

  const { loading, markets: rawMarkets, refetch, isRefetching } = useMarkets();

  const {
    isOpen: isSettingsModalOpen,
    onOpen: onSettingsModalOpen,
    onOpenChange: onSettingsModalOpenChange,
  } = useDisclosure();

  const defaultNetwork = (() => {
    const networkParam = searchParams.get('network');
    return networkParam &&
      Object.values(SupportedNetworks).includes(Number(networkParam) as SupportedNetworks)
      ? (Number(networkParam) as SupportedNetworks)
      : null;
  })();

  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>([]);
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(defaultNetwork);

  const [uniqueCollaterals, setUniqueCollaterals] = useState<(ERC20Token | UnknownERC20Token)[]>(
    [],
  );
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<(ERC20Token | UnknownERC20Token)[]>([]);

  const [sortColumn, setSortColumn] = useState<SortColumn>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);

  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | undefined>(undefined);

  const [staredIds, setStaredIds] = useState<string[]>(defaultStaredMarkets);

  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([]);

  const prevParamsRef = useRef<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedOracles, setSelectedOracles] = useState<OracleVendors[]>([]);

  const { currentPage, setCurrentPage, entriesPerPage, handleEntriesPerPageChange, resetPage } =
    usePagination();

  const [includeUnknownTokens, setIncludeUnknownTokens] = useLocalStorage(
    'includeUnknownTokens',
    false,
  );
  const [showUnknownOracle, setShowUnknownOracle] = useLocalStorage('showUnknownOracle', false);

  const { allTokens, findToken } = useTokens();

  const [usdFilters, setUsdFilters] = useState({
    minSupply: '',
    minBorrow: '',
  });

  useEffect(() => {
    const currentParams = searchParams.toString();
    if (currentParams !== prevParamsRef.current) {
      const collaterals = searchParams.get('collaterals');
      setSelectedCollaterals(collaterals ? collaterals.split(',').filter(Boolean) : []);

      const loanAssets = searchParams.get('loanAssets');
      setSelectedLoanAssets(loanAssets ? loanAssets.split(',').filter(Boolean) : []);

      const networkParam = searchParams.get('network');
      setSelectedNetwork(
        networkParam &&
          Object.values(SupportedNetworks).includes(Number(networkParam) as SupportedNetworks)
          ? (Number(networkParam) as SupportedNetworks)
          : null,
      );

      prevParamsRef.current = currentParams;
    }
  }, [searchParams]);

  const starMarket = useCallback(
    (id: string) => {
      setStaredIds([...staredIds, id]);
      storage.setItem(keys.MarketFavoritesKey, JSON.stringify([...staredIds, id]));
      toast.success('Market starred', 'Market added to favorites', { icon: <span>🌟</span> });
    },
    [staredIds, toast],
  );

  const unstarMarket = useCallback(
    (id: string) => {
      setStaredIds(staredIds.filter((i) => i !== id));
      storage.setItem(keys.MarketFavoritesKey, JSON.stringify(staredIds.filter((i) => i !== id)));
      toast.success('Market unstarred', 'Market removed from favorites', { icon: <span>🌟</span> });
    },
    [staredIds, toast],
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
      const params = new URLSearchParams(Object.fromEntries(searchParams));
      if (collaterals.length > 0) {
        params.set('collaterals', collaterals.join(','));
      } else {
        params.delete('collaterals');
      }
      if (loanAssets.length > 0) {
        params.set('loanAssets', loanAssets.join(','));
      } else {
        params.delete('loanAssets');
      }
      if (network) {
        params.set('network', network.toString());
      } else {
        params.delete('network');
      }
      const newParams = params.toString();
      if (newParams !== prevParamsRef.current) {
        router.push(`?${newParams}`, { scroll: false });
        prevParamsRef.current = newParams;
      }
    },
    [router, searchParams],
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
      const { vendors } = parseOracleVendors(market.oracle.data);
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
      storage.setItem(keys.MarketSortColumnKey, column.toString());

      if (column === sortColumn) {
        setSortDirection(-sortDirection);
        storage.setItem(keys.MarketSortDirectionKey, (-sortDirection).toString());
      }
    },
    [sortColumn, sortDirection],
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
    // Construct the current query parameters
    const currentParams = searchParams.toString();
    const marketPath = `/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`;

    // If we have query params, append them to the market detail URL
    const targetPath = currentParams ? `${marketPath}?${currentParams}` : marketPath;
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
              onClick={handleRefresh}
            >
              <FaSync className={`${isRefetching ? 'animate-spin' : ''} mr-1`} size={10} />
              Refresh
            </Button>

            <Button
              isIconOnly
              aria-label="Market View Settings"
              variant="light"
              size="sm"
              className="text-secondary"
              onClick={onSettingsModalOpen}
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
