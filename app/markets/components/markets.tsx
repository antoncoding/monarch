'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Tooltip } from '@nextui-org/react';
import { Chain } from '@rainbow-me/rainbowkit';
import storage from 'local-storage-fallback';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModal } from '@/components/supplyModal';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarkets } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { SupportedNetworks } from '@/utils/networks';
import { OracleVendors, parseOracleVendors } from '@/utils/oracle';
import * as keys from '@/utils/storageKeys';
import { ERC20Token, getUniqueTokens, UnknownERC20Token } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { Button } from '@/components/common';

import AdvancedSearchBar, { ShortcutType } from './AdvancedSearchBar';
import AssetFilter from './AssetFilter';
import { SortColumn } from './constants';
import MarketsTable from './marketsTable';
import NetworkFilter from './NetworkFilter';
import OracleFilter from './OracleFilter';
import { applyFilterAndSort } from './utils';

const defaultSortColumn = Number(
  storage.getItem(keys.MarketSortColumnKey) ?? SortColumn.Supply.toString(),
);
const defaultSortDirection = Number(storage.getItem(keys.MarketSortDirectionKey) ?? '-1');
const defaultStaredMarkets = JSON.parse(
  storage.getItem(keys.MarketFavoritesKey) ?? '[]',
) as string[];

export default function Markets() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { loading, markets: rawMarkets, refetch, isRefetching } = useMarkets();

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

  const [includeUnknownTokens] = useLocalStorage('includeUnknownTokens', false);
  const [showUnknownOracle] = useLocalStorage('showUnknownOracle', false);

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
      toast.success('Market starred', { icon: <span>🌟</span> });
    },
    [staredIds],
  );

  const unstarMarket = useCallback(
    (id: string) => {
      setStaredIds(staredIds.filter((i) => i !== id));
      storage.setItem(keys.MarketFavoritesKey, JSON.stringify(staredIds.filter((i) => i !== id)));
      toast.success('Market unstarred', { icon: <span>🌟</span> });
    },
    [staredIds],
  );

  useEffect(() => {
    if (rawMarkets) {
      const processTokens = (
        tokenInfoList: { address: string; chainId: number; symbol: string; decimals: number }[],
      ) => {
        const knownTokens = getUniqueTokens(tokenInfoList);

        if (!includeUnknownTokens) return knownTokens;

        // Process unknown tokens
        const unknownTokensBySymbol = tokenInfoList.reduce(
          (acc, token) => {
            if (
              !knownTokens.some((known) =>
                known.networks.some(
                  (n) =>
                    n.address.toLowerCase() === token.address.toLowerCase() &&
                    n.chain.id === token.chainId,
                ),
              )
            ) {
              if (!acc[token.symbol]) {
                acc[token.symbol] = {
                  symbol:
                    token.symbol.length > 10 ? `${token.symbol.slice(0, 10)}...` : token.symbol,
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

        return [...knownTokens, ...Object.values(unknownTokensBySymbol)];
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
    }
  }, [rawMarkets, includeUnknownTokens]);

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
    showUnknownOracle,
    selectedCollaterals,
    selectedLoanAssets,
    selectedOracles,
    searchQuery,
    resetPage,
    staredIds,
  ]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  const titleOnclick = useCallback(
    (column: number) => {
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
    router.push(targetPath);
  };

  const handleRefresh = () => {
    refetch(() => toast.success('Markets refreshed'));
  };

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8" style={{ padding: '0 5%' }}>
        <h1 className="py-8 font-zen"> Markets </h1>

        {showSupplyModal && (
          <SupplyModal
            market={selectedMarket as Market}
            onClose={() => setShowSupplyModal(false)}
          />
        )}

        {/* Pass uniqueCollaterals and uniqueLoanAssets to AdvancedSearchBar */}
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

        {/* basic filter row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          {/* left section: asset filters */}
          <div className="flex flex-col gap-4 lg:flex-row">
            <Tooltip
              content="Can't find what you're looking for? Check the settings page for additional filter options."
              placement="bottom"
            >
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
            </Tooltip>
          </div>

          <div className="mt-4 flex gap-2 lg:mt-0">
            <Button
              disabled={loading || isRefetching}
              variant="light"
              color="surface"
              size="sm"
              className="text-secondary"
              onClick={handleRefresh}
            >
              <FaSync className={`${isRefetching ? 'animate-spin' : ''} mr-2`} size={10} />
              Refresh
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
                setShowSupplyModal={setShowSupplyModal}
                setSelectedMarket={setSelectedMarket}
                staredIds={staredIds}
                starMarket={starMarket}
                unstarMarket={unstarMarket}
                currentPage={currentPage}
                entriesPerPage={entriesPerPage}
                handleEntriesPerPageChange={handleEntriesPerPageChange}
                setCurrentPage={setCurrentPage}
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
