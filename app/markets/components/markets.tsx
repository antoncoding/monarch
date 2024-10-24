'use client';
import { Input } from '@nextui-org/input';
import { useCallback, useEffect, useState, useRef } from 'react';
import storage from 'local-storage-fallback';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSearch, FaEllipsisH } from 'react-icons/fa'; // Import search and ellipsis icons
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { SupplyModal } from '@/components/supplyModal';
import useMarkets from '@/hooks/useMarkets';
import { SupportedNetworks } from '@/utils/networks';
import * as keys from '@/utils/storageKeys';
import { ERC20Token, getUniqueTokens } from '@/utils/tokens';
import { Market } from '@/utils/types';

import AssetFilter from './AssetFilter';
import CheckFilter from './CheckFilter';
import { SortColumn } from './constants';
import MarketsTable from './marketsTable';
import NetworkFilter from './NetworkFilter';
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

  const { loading, data: rawMarkets } = useMarkets();

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

  const [filteredMarkets, setFilteredMarkets] = useState(rawMarkets);

  const prevParamsRef = useRef<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>('all');

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
    },
    [staredIds],
  );

  const unstarMarket = useCallback(
    (id: string) => {
      setStaredIds(staredIds.filter((i) => i !== id));
      storage.setItem(keys.MarketFavoritesKey, JSON.stringify(staredIds.filter((i) => i !== id)));
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

  useEffect(() => {
    const filtered = applyFilterAndSort(
      rawMarkets,
      sortColumn,
      sortDirection,
      selectedNetwork,
      showUnknown,
      showUnknownOracle,
      selectedCollaterals,
      selectedLoanAssets,
    ).filter((market) => {
      const query = searchQuery.toLowerCase();
      const riskWarnings = market.warningsWithDetail || [];
      const riskLevel = riskWarnings.length;

      if (riskFilter === 'threeGreen' && riskLevel > 0) return false;
      if (riskFilter === 'twoGreen' && riskLevel > 1) return false;

      return (
        market.id.toLowerCase().startsWith(query) ||
        market.collateralAsset.symbol.toLowerCase().includes(query) ||
        market.loanAsset.symbol.toLowerCase().includes(query)
      );
    });
    setFilteredMarkets(filtered);
  }, [
    rawMarkets,
    sortColumn,
    sortDirection,
    showUnknown,
    showUnknownOracle,
    selectedCollaterals,
    selectedLoanAssets,
    selectedNetwork,
    searchQuery,
    riskFilter,
  ]);

  useEffect(() => {
    updateUrlParams(selectedCollaterals, selectedLoanAssets, selectedNetwork);
  }, [selectedCollaterals, selectedLoanAssets, selectedNetwork, updateUrlParams]);

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

        {/* search bar row */}
        <div className="flex items-center justify-between pb-4">
          <Input
            id="market-search-input"
            label="Search"
            placeholder="Search by Market ID or Asset (Ctrl+F)"
            value={searchQuery}
            onValueChange={setSearchQuery}
            endContent={<FaSearch className="text-gray-500" />}
            classNames={{
              inputWrapper: 'bg-secondary rounded-sm w-64',
              input: 'bg-secondary rounded-sm text-xs',
            }}
          />
        </div>

        {/* basic filter row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          {/* left section: asset filters */}
          <div className="flex flex-col gap-2 lg:flex-row">
            {/* network filter */}
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
            />
          </div>

          <div>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              type="button"
              className="flex items-center gap-2 rounded-md bg-gray-200 px-3 py-1 text-sm text-secondary transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <FaEllipsisH size={16} />
              Advanced
            </button>
          </div>
        </div>

        {/* advanced filters */}
        {showAdvancedSettings && (
          <div className="my-4 flex flex-col gap-4 p-2 lg:flex-row">
            <CheckFilter
              checked={showUnknown}
              onChange={(checked: boolean) => {
                setShowUnknown(checked);
                storage.setItem(keys.MarketsShowUnknownKey, checked.toString());
              }}
              label="Show Unknown Assets"
              tooltip="Show markets with unknown assets"
            />

            <CheckFilter
              checked={showUnknownOracle}
              onChange={(checked: boolean) => {
                setShowUnknownOracle(checked);
                storage.setItem(keys.MarketsShowUnknownOracleKey, checked.toString());
              }}
              label="Show Unknown Oracle"
              tooltip="Show markets with unknown oracle"
            />
          </div>
        )}

        {loading ? (
          <LoadingScreen message="Loading Morpho Blue Markets..." />
        ) : rawMarkets == null ? (
          <div> No data </div>
        ) : (
          <div className="max-w-screen mt-4">
            <MarketsTable
              markets={filteredMarkets}
              titleOnclick={titleOnclick}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              setShowSupplyModal={setShowSupplyModal}
              setSelectedMarket={setSelectedMarket}
              staredIds={staredIds}
              starMarket={starMarket}
              unstarMarket={unstarMarket}
            />
          </div>
        )}
      </div>
    </div>
  );
}
