'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import storage from 'local-storage-fallback';
import { useRouter, useSearchParams } from 'next/navigation';
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
const defaultHideDust = storage.getItem(keys.MarketsHideDustKey) === 'true';
const defaultHideUnknown = storage.getItem(keys.MarketsHideUnknownKey) === 'true';

const defaultStaredMarkets = JSON.parse(
  storage.getItem(keys.MarketFavoritesKey) ?? '[]',
) as string[];

/**
 * Use the page component toLowerCase() wrap the components
 * that you want toLowerCase() render on the page.
 */
export default function Markets() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { loading, data: rawMarkets } = useMarkets();

  // Parse and validate network parameter
  const defaultNetwork = (() => {
    const networkParam = searchParams.get('network');
    return networkParam &&
      Object.values(SupportedNetworks).includes(Number(networkParam) as SupportedNetworks)
      ? (Number(networkParam) as SupportedNetworks)
      : null;
  })();

  // Initialize states
  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>([]);
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(defaultNetwork);

  const [uniqueCollaterals, setUniqueCollaterals] = useState<ERC20Token[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<ERC20Token[]>([]);

  // Add state for the checkbox
  const [hideDust, setHideDust] = useState(defaultHideDust);
  const [hideUnknown, setHideUnknown] = useState(defaultHideUnknown);

  // Add state for the sort column and direction
  const [sortColumn, setSortColumn] = useState<SortColumn>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);

  // Control supply modal
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | undefined>(undefined);

  const [staredIds, setStaredIds] = useState<string[]>(defaultStaredMarkets);

  const [filteredMarkets, setFilteredMarkets] = useState(rawMarkets);

  // Use useRef to store the previous URL parameters
  const prevParamsRef = useRef<string>('');

  // Synchronize state with URL parameters
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

  // Update the unique collateral and loan assets when the data changes
  useEffect(() => {
    if (rawMarkets) {
      const collatList = rawMarkets.map((m) => {
        return { address: m.collateralAsset.address, chainId: m.morphoBlue.chain.id };
      });
      const loanList = rawMarkets.map((m) => {
        return { address: m.loanAsset.address, chainId: m.morphoBlue.chain.id };
      });
      // filter ERC20Token objects that exist in markets list
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

  // Update filtered markets
  useEffect(() => {
    const filtered = applyFilterAndSort(
      rawMarkets,
      sortColumn,
      sortDirection,
      selectedNetwork,
      hideDust,
      hideUnknown,
      selectedCollaterals,
      selectedLoanAssets,
    );
    setFilteredMarkets(filtered);
  }, [
    rawMarkets,
    hideDust,
    sortColumn,
    sortDirection,
    hideUnknown,
    selectedCollaterals,
    selectedLoanAssets,
    selectedNetwork,
  ]);

  // Update URL params when filters change
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

            {/* collateral  */}
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

          {/* right section: checkbox */}
          <div className="my-2 flex items-center justify-start rounded-sm p-2 lg:justify-end">
            <CheckFilter
              checked={hideDust}
              onChange={(checked: boolean) => {
                setHideDust(checked);
                storage.setItem(keys.MarketsHideDustKey, checked.toString());
              }}
              label="Hide Dust"
              tooltip="Hide markets with lower than $1000 supplied"
            />

            <CheckFilter
              checked={hideUnknown}
              onChange={(checked: boolean) => {
                setHideUnknown(checked);
                storage.setItem(keys.MarketsHideUnknownKey, checked.toString());
              }}
              label="Hide Unknown"
              tooltip="Hide markets with unknown assets"
            />
          </div>
        </div>

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
