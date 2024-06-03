/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDownIcon, TrashIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import storage from 'local-storage-fallback';
import Image from 'next/image';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useMarkets, { Market } from '@/hooks/useMarkets';

import { generateMetadata } from '@/utils/generateMetadata';
import * as keys from '@/utils/storageKeys';
import { supportedTokens, ERC20Token } from '@/utils/tokens';

import MarketsTable from './marketsTable';
import { SupplyModal } from './supplyModal';

const allSupportedAddresses = supportedTokens.map((token) => token.address.toLowerCase());

const defaultSortColumn = Number(storage.getItem(keys.MarketSortColumnKey) ?? '5');
const defaultSortDirection = Number(storage.getItem(keys.MarketSortDirectionKey) ?? '-1');
const defaultHideDust = storage.getItem(keys.MarketsHideDustKey) === 'true';
const defaultHideUnknown = storage.getItem(keys.MarketsHideUnknownKey) === 'true';

const defaultStaredMarkets = JSON.parse(
  storage.getItem(keys.MarketFavoritesKey) ?? '[]',
) as string[];

export const metadata = generateMetadata({
  title: 'Markets',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

/**
 * Use the page component toLowerCase() wrap the components
 * that you want toLowerCase() render on the page.
 */
export default function HomePage() {
  const { loading, data } = useMarkets();

  const [expandCollatOptions, setExpandCollatOptions] = useState(false);
  const [expandLoanOptions, setExpandedLoanOptions] = useState(false);

  // Add state for the selected collateral and loan asset
  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>([]);
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<string[]>([]);

  // Add state for the unique collateral and loan assets, for users toLowerCase() set filters
  const [uniqueCollaterals, setUniqueCollaterals] = useState<string[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<string[]>([]);

  // Add state for the checkbox
  const [hideDust, setHideDust] = useState(defaultHideDust);
  const [hideUnknown, setHideUnknown] = useState(defaultHideUnknown);

  // Add state for the sort column and direction
  const [sortColumn, setSortColumn] = useState(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);

  // Control supply modal
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | undefined>(undefined);

  const [staredIds, setStaredIds] = useState<string[]>(defaultStaredMarkets);

  const [filteredData, setFilteredData] = useState(data);

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
    if (data) {
      const collaterals = [
        ...new Set(data.map((item) => item.collateralAsset.address.toLowerCase())),
      ].filter((address) => allSupportedAddresses.includes(address.toLowerCase()));
      const loanAssets = [
        ...new Set(data.map((item) => item.loanAsset.address.toLowerCase())),
      ].filter((address) => allSupportedAddresses.includes(address.toLowerCase()));
      setUniqueCollaterals(collaterals);
      setUniqueLoanAssets(loanAssets);
    }
  }, [data]);

  // Update the filter effect toLowerCase() also filter based on the checkbox
  useEffect(() => {
    let newData = [...data];

    if (hideDust) {
      newData = newData
        .filter((item) => Number(item.state.supplyAssetsUsd) > 1000)
        .filter((item) => Number(item.state.borrowAssetsUsd) > 100);
    }

    if (hideUnknown) {
      newData = newData
        // Filter out any items which's collateral are not in the supported tokens list
        .filter((item) =>
          allSupportedAddresses.find(
            (address) => address === item.collateralAsset.address.toLocaleLowerCase(),
          ),
        )
        // Filter out any items which's loan are not in the supported tokens list
        .filter((item) =>
          allSupportedAddresses.find(
            (address) => address === item.loanAsset.address.toLocaleLowerCase(),
          ),
        );
    }

    if (selectedCollaterals.length > 0) {
      newData = newData.filter((item) =>
        selectedCollaterals.includes(item.collateralAsset.address.toLowerCase()),
      );
    }

    if (selectedLoanAssets.length > 0) {
      newData = newData.filter((item) =>
        selectedLoanAssets.includes(item.loanAsset.address.toLowerCase()),
      );
    }

    switch (sortColumn) {
      case 1:
        newData.sort((a, b) =>
          a.loanAsset.name > b.loanAsset.name ? sortDirection : -sortDirection,
        );
        break;
      case 2:
        newData.sort((a, b) =>
          a.collateralAsset.name > b.collateralAsset.name ? sortDirection : -sortDirection,
        );
        break;
      case 3:
        newData.sort((a, b) => (a.lltv > b.lltv ? sortDirection : -sortDirection));
        break;
      case 4:
        newData.sort((a, b) =>
          Number(a.rewardPer1000USD ?? '0') > Number(b.rewardPer1000USD ?? '0')
            ? sortDirection
            : -sortDirection,
        );
        break;
      case 5:
        newData.sort((a, b) =>
          a.state.supplyAssetsUsd > b.state.supplyAssetsUsd ? sortDirection : -sortDirection,
        );
        break;
      case 6:
        newData.sort((a, b) =>
          a.state.borrowAssetsUsd > b.state.borrowAssetsUsd ? sortDirection : -sortDirection,
        );
        break;
      case 7:
        newData.sort((a, b) =>
          a.state.supplyApy > b.state.supplyApy ? sortDirection : -sortDirection,
        );
        break;
    }

    setFilteredData(newData);
  }, [
    data,
    hideDust,
    sortColumn,
    sortDirection,
    hideUnknown,
    selectedCollaterals,
    selectedLoanAssets,
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
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <Toaster />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <h1 className="py-8 font-zen"> Markets </h1>

        {showSupplyModal && (
          <SupplyModal
            market={selectedMarket as Market}
            onClose={() => setShowSupplyModal(false)}
          />
        )}

        <div className="flex justify-between">
          <div className="flex gap-1">
            {/* collateral filter */}
            <button
              type="button"
              className="bg-secondary my-1 flex items-center justify-center gap-2 rounded-sm p-3 hover:opacity-80"
              onClick={() => {
                setExpandedLoanOptions(!expandLoanOptions);
              }}
            >
              Loans{' '}
              {selectedLoanAssets.length === 0 ? (
                expandLoanOptions ? (
                  <ChevronUpIcon />
                ) : (
                  <ChevronDownIcon />
                )
              ) : (
                <span className="bg-monarch-orange rounded-xl px-2 py-1 text-xs">
                  {selectedLoanAssets.length}{' '}
                </span>
              )}
            </button>

            <button
              type="button"
              className="bg-secondary hover:bg-hovered my-1 flex items-center justify-center gap-2 rounded-sm p-3"
              onClick={() => {
                setExpandCollatOptions(!expandCollatOptions);
              }}
            >
              Collaterals{' '}
              {selectedCollaterals.length === 0 ? (
                expandCollatOptions ? (
                  <ChevronUpIcon />
                ) : (
                  <ChevronDownIcon />
                )
              ) : (
                <span className="bg-monarch-orange rounded-xl px-2 py-1 text-xs">
                  {selectedCollaterals.length}{' '}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 rounded-sm">
            <label className="bg-secondary my-1 flex items-center px-2 py-1">
              <input
                type="checkbox"
                checked={hideDust}
                onChange={(e) => {
                  setHideDust(e.target.checked);
                  storage.setItem(keys.MarketsHideDustKey, e.target.checked.toString());
                }}
              />
              <p className="p-2">Hide dust</p>
            </label>

            <label className="bg-secondary my-1 flex items-center rounded-sm px-2 py-1">
              <input
                type="checkbox"
                checked={hideUnknown}
                onChange={(e) => {
                  setHideUnknown(e.target.checked);
                  storage.setItem(keys.MarketsHideUnknownKey, e.target.checked.toString());
                }}
              />
              <p className="p-2">Hide unknown</p>
            </label>
          </div>
        </div>

        {/* loan asset filter section: all option as buttons */}
        {expandLoanOptions && (
          <div className="transition-all duration-500 ease-in-out">
            <p className="text-sm opacity-80"> Filter loans </p>
            <div className="flex gap-1 overflow-auto">
              <button
                type="button"
                className="bg-secondary my-1 flex items-center justify-center gap-2 rounded-sm px-2 py-2"
                onClick={() => {
                  setSelectedLoanAssets([]);
                }}
              >
                Clear <TrashIcon />
              </button>
              {uniqueLoanAssets.map((loanAsset) => {
                const token = supportedTokens.find(
                  (t) => t.address.toLowerCase() === loanAsset,
                ) as ERC20Token;

                // just in case
                if (!token) return null;
                const chosen = selectedLoanAssets.includes(token.address.toLowerCase());

                return (
                  <button
                    key={`loan-${loanAsset}`}
                    className={`flex ${
                      chosen ? 'bg-hovered' : 'bg-secondary'
                    } my-1 items-center justify-center gap-1 rounded-sm p-2 px-5`}
                    type="button"
                    onClick={() => {
                      if (selectedLoanAssets.includes(token.address.toLowerCase())) {
                        setSelectedLoanAssets(
                          selectedLoanAssets.filter((c) => c !== token.address.toLowerCase()),
                        );
                      } else {
                        setSelectedLoanAssets([...selectedLoanAssets, token.address.toLowerCase()]);
                      }
                    }}
                  >
                    <p>{token?.symbol}</p>
                    {token.img && <Image src={token.img} alt="icon" height="18" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* collateral filter section: all option as check box */}
        {expandCollatOptions && (
          <div className="transition-all duration-500 ease-in-out">
            <p className="text-sm opacity-80"> Filter collaterals </p>
            <div className="flex gap-1 overflow-auto">
              <button
                type="button"
                className="bg-secondary my-1 flex items-center justify-center gap-2 rounded-sm px-2 py-2"
                onClick={() => {
                  setSelectedCollaterals([]);
                }}
              >
                Clear <TrashIcon />
              </button>

              {uniqueCollaterals.map((collateral) => {
                const token = supportedTokens.find(
                  (t) => t.address.toLowerCase() === collateral,
                ) as ERC20Token;

                const chosen = selectedCollaterals.includes(token.address.toLowerCase());

                return (
                  <button
                    key={`loan-${collateral}`}
                    className={`flex ${
                      chosen ? 'bg-hovered' : 'bg-secondary'
                    } my-1 items-center justify-center gap-1 rounded-sm p-2 px-5`}
                    type="button"
                    onClick={() => {
                      if (selectedCollaterals.includes(token.address.toLowerCase())) {
                        setSelectedCollaterals(
                          selectedCollaterals.filter((c) => c !== token.address.toLowerCase()),
                        );
                      } else {
                        setSelectedCollaterals([
                          ...selectedCollaterals,
                          token.address.toLowerCase(),
                        ]);
                      }
                    }}
                  >
                    <p>{token?.symbol}</p>
                    {token.img && <Image src={token.img} alt="icon" height="18" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-3 opacity-70"> Loading Morpho Blue Markets... </div>
        ) : data == null ? (
          <div> No data </div>
        ) : (
          <div className="bg-secondary mt-4">
            <MarketsTable
              markets={filteredData}
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
