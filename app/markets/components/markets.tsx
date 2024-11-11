'use client';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import storage from 'local-storage-fallback';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaEllipsisH, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAccount, useSwitchChain } from 'wagmi';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModal } from '@/components/supplyModal';
import { useMarkets } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { SupportedNetworks } from '@/utils/networks';
import { OracleVendors, parseOracleVendors } from '@/utils/oracle';
import * as keys from '@/utils/storageKeys';
import { ERC20Token, getUniqueTokens } from '@/utils/tokens';
import { Market } from '@/utils/types';

import AdvancedSearchBar, { ShortcutType } from './AdvancedSearchBar';
import AssetFilter from './AssetFilter';
import CheckFilter from './CheckFilter';
import { SortColumn } from './constants';
import MarketsTable from './marketsTable';
import NetworkFilter from './NetworkFilter';
import OracleFilter from './OracleFilter';
import { applyFilterAndSort } from './utils';

const defaultSortColumn = Number(
  storage.getItem(keys.MarketSortColumnKey) ?? SortColumn.Supply.toString(),
);
const defaultSortDirection = Number(storage.getItem(keys.MarketSortDirectionKey) ?? '-1');
const defaultShowUnknown = storage.getItem(keys.MarketsShowUnknownKey) === 'true';
const defaultShowUnknownOracle = storage.getItem(keys.MarketsShowUnknownOracleKey) === 'true';
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

  const [uniqueCollaterals, setUniqueCollaterals] = useState<ERC20Token[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<ERC20Token[]>([]);

  const [showUnknown, setShowUnknown] = useState(defaultShowUnknown);
  const [showUnknownOracle, setShowUnknownOracle] = useState(defaultShowUnknownOracle);
  const [sortColumn, setSortColumn] = useState<SortColumn>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);

  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | undefined>(undefined);

  const [staredIds, setStaredIds] = useState<string[]>(defaultStaredMarkets);

  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([]);

  const prevParamsRef = useRef<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const [selectedOracles, setSelectedOracles] = useState<OracleVendors[]>([]);

  const { currentPage, setCurrentPage, entriesPerPage, handleEntriesPerPageChange, resetPage } =
    usePagination();

  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const needSwitchChain = useMemo(
    () => chainId !== selectedNetwork && selectedNetwork !== null,
    [chainId, selectedNetwork],
  );

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
      const collatList = rawMarkets.map((m) => {
        return { address: m.collateralAsset.address, chainId: m.morphoBlue.chain.id };
      });
      const loanList = rawMarkets.map((m) => {
        return { address: m.loanAsset.address, chainId: m.morphoBlue.chain.id };
      });
      setUniqueCollaterals(getUniqueTokens(collatList));
      setUniqueLoanAssets(getUniqueTokens(loanList));
    }
  }, [rawMarkets]);

  const updateUrlParams = useCallback(
    (collaterals: string[], loanAssets: string[], network: SupportedNetworks | null) => {
      const params = new URLSearchParams(searchParams);
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
      showUnknown,
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
    showUnknown,
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
            <div className="flex items-center gap-2">
              <NetworkFilter
                selectedNetwork={selectedNetwork}
                setSelectedNetwork={(network) => {
                  setSelectedNetwork(network);
                  updateUrlParams(selectedCollaterals, selectedLoanAssets, network);
                }}
              />
              
              {needSwitchChain && (
                <button
                  type="button"
                  onClick={() => selectedNetwork && switchChain({ chainId: selectedNetwork })}
                  className="bg-monarch-orange h-10 rounded px-4 text-sm text-white opacity-90 transition-all duration-300 ease-in-out hover:scale-105 hover:opacity-100"
                >
                  Switch Network
                </button>
              )}
            </div>

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

          <div className="mt-4 lg:mt-0 flex gap-2">
            <button
              onClick={handleRefresh}
              type="button"
              disabled={loading || isRefetching}
              className={`flex items-center gap-2 rounded-md bg-gray-200 p-2 px-3 text-sm text-secondary transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 ${
                loading || isRefetching ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <FaSync className={`${loading || isRefetching ? 'animate-spin' : ''}`} size={10} />
              Refresh
            </button>

            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              type="button"
              aria-expanded={showAdvancedSettings}
              aria-controls="advanced-settings-panel"
              className="flex items-center gap-2 rounded-md bg-gray-200 p-2 px-3 text-sm text-secondary transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <FaEllipsisH size={16} className={showAdvancedSettings ? 'rotate-180' : ''} />
              Advanced
            </button>
          </div>
        </div>

        {/* advanced filters */}
        <div
          className={`flex flex-row overflow-hidden transition-all duration-300 ease-in-out md:flex-col ${
            showAdvancedSettings ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="mt-4 flex flex-col gap-8 p-2 sm:flex-row">
            <CheckFilter
              checked={showUnknown}
              onChange={(checked: boolean) => {
                setShowUnknown(checked);
                storage.setItem(keys.MarketsShowUnknownKey, checked.toString());
              }}
              label="Show Unknown Assets"
            />

            <CheckFilter
              checked={showUnknownOracle}
              onChange={(checked: boolean) => {
                setShowUnknownOracle(checked);
                storage.setItem(keys.MarketsShowUnknownOracleKey, checked.toString());
              }}
              label="Show Unknown Oracle"
            />
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
                hint="Try adjusting your filters or search query to see more results."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
