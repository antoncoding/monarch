'use client';
import { useCallback, useEffect, useState } from 'react';
import storage from 'local-storage-fallback';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useMarkets, { Market } from '@/hooks/useMarkets';

import { SupportedNetworks } from '@/utils/networks';
import * as keys from '@/utils/storageKeys';
import {
  supportedTokens,
  ERC20Token,
} from '@/utils/tokens';

import AssetFilter from './AssetFilter';
import CheckFilter from './CheckFilter';
import { SortColumn } from './constants';
import MarketsTable from './marketsTable';
import NetworkFilter from './NetworkFilter';
import { SupplyModal } from './supplyModal';
import { applyFilterAndSort } from './utils';

const defaultSortColumn = Number(storage.getItem(keys.MarketSortColumnKey) ?? SortColumn.Supply.toString());
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
  const { loading, data: rawMarkets } = useMarkets();

  // token keys, aggregated with | for each "ERC20Token" object
  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>([]);
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<string[]>([]);

  // single choice: null for all networks
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(null);

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
      // filter ERC20Token objects that exist in markets list
      const collaterals = supportedTokens.filter((token) => {
        return rawMarkets.find((market) =>
          token.networks.find(
            (network) =>
              network.address.toLowerCase() === market.collateralAsset.address.toLowerCase() &&
              network.chain.id === market.morphoBlue.chain.id,
          ),
        );
      });

      const loanAssets = supportedTokens.filter((token) => {
        return rawMarkets.find((market) =>
          token.networks.find(
            (network) =>
              network.address.toLowerCase() === market.loanAsset.address.toLowerCase() &&
              network.chain.id === market.morphoBlue.chain.id,
          ),
        );
      });
      setUniqueCollaterals(collaterals);
      setUniqueLoanAssets(loanAssets);
    }
  }, [rawMarkets]);

  // Update the all markets pass to the table
  useEffect(() => {
    const filtered = applyFilterAndSort(rawMarkets, sortColumn, sortDirection, selectedNetwork, hideDust, hideUnknown, selectedCollaterals, selectedLoanAssets)
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
      <Toaster />
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
            <NetworkFilter setSelectedNetwork={setSelectedNetwork} />

            <AssetFilter
              label="Loan Asset"
              placeholder="All loan asset"
              selectedAssets={selectedLoanAssets}
              setSelectedAssets={setSelectedLoanAssets}
              items={uniqueLoanAssets}
              loading={loading}
            />


            {/* collateral  */}
            <AssetFilter
              label="Collateral"
              placeholder="All collateral"
              selectedAssets={selectedCollaterals}
              setSelectedAssets={setSelectedCollaterals}
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
              label='Hide Dust'
              tooltip='Hide markets with lower than $1000 supplied'
            />

            <CheckFilter
              checked={hideUnknown}
              onChange={(checked: boolean) => {
                setHideUnknown(checked);
                storage.setItem(keys.MarketsHideUnknownKey, checked.toString());
              }}
              label='Hide Unknown'
              tooltip='Hide markets with unknown assets'
            />
          </div>
        </div>

        {loading ? (
          <div className="py-3 opacity-70"> Loading Morpho Blue Markets... </div>
        ) : rawMarkets == null ? (
          <div> No data </div>
        ) : (
          <div className="max-w-screen mt-4 overflow-auto bg-secondary">
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
