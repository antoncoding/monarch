/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDownIcon, TrashIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useMarkets, { Market } from '@/hooks/useMarkets';

import { generateMetadata } from '@/utils/generateMetadata';
import { supportedTokens, ERC20Token } from '@/utils/tokens';

import MarketsTable from './marketsTable';
import { SupplyModal } from './supplyModal';

const allSupportedAddresses = supportedTokens.map((token) => token.address.toLowerCase());

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
  const [hideDust, setHideDust] = useState(true);
  const [hideUnknown, setHideUnknown] = useState(true);

  // Add state for the sort column and direction
  const [sortColumn, setSortColumn] = useState(5);
  const [sortDirection, setSortDirection] = useState(-1);

  // Control supply modal
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | undefined>(undefined);

  const [filteredData, setFilteredData] = useState(data);

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
    let newData = data;

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
      if (column === sortColumn) setSortDirection(-sortDirection);
    },
    [sortColumn, sortDirection],
  );

  return (
    <div className="font-roboto flex flex-col justify-between">
      <Header />
      <Toaster />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <h1 className="font-roboto py-8"> Markets </h1>

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
              Filter Loan{' '}
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
              Filter Collateral{' '}
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
                onChange={(e) => setHideDust(e.target.checked)}
              />
              <p className="p-2">Hide dust</p>
            </label>

            <label className="bg-secondary my-1 flex items-center rounded-sm px-2 py-1">
              <input
                type="checkbox"
                checked={hideUnknown}
                onChange={(e) => setHideUnknown(e.target.checked)}
              />
              <p className="p-2">Hide unknown</p>
            </label>
          </div>
        </div>

        {/* loan asset filter section: all option as buttons */}
        {expandLoanOptions && (
          <div className="transition-all duration-500 ease-in-out">
            <p className="text-sm opacity-80"> Choose loans </p>
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
            <p className="text-sm opacity-80"> Choose collaterals </p>
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
