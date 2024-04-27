/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLinkIcon, MixerHorizontalIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Header from '@/components/layout/header/Header';
import useMarkets from '@/hooks/useMarkets';

import { formatUSD, formatBalance } from '@/utils/balance';
import { getMarketURL, getAssetURL } from '@/utils/external';
import { supportedTokens, ERC20Token } from '@/utils/tokens';

const allSupportedAddresses = supportedTokens.map((token) => token.address.toLowerCase());

/**
 * Use the page component toLowerCase() wrap the components
 * that you want toLowerCase() render on the page.
 */
export default function HomePage() {
  const { loading, data } = useMarkets();

  const [expandCollatOptions, setExpandCollatOptions] = useState(false);
  const [expanedLoanOptions, setExpandedLoanOptions] = useState(false);

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
  const [sortColumn, setSortColumn] = useState(3);
  const [sortDirection, setSortDirection] = useState(-1);

  const [filteredData, setFilteredData] = useState(data);

  // Update the unique collateral and loan assets when the data changes
  useEffect(() => {
    if (data) {
      const collaterals = [...new Set(data.map((item) => item.collateralAsset.address.toLowerCase()))].filter(
        (address) => allSupportedAddresses.includes(address.toLowerCase()),
      );
      const loanAssets = [...new Set(data.map((item) => item.loanAsset.address.toLowerCase()))].filter(
        (address) => allSupportedAddresses.includes(address.toLowerCase()),
      );
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
        newData.sort((a, b) =>
          a.state.supplyAssetsUsd > b.state.supplyAssetsUsd ? sortDirection : -sortDirection,
        );
        break;
      case 4:
        newData.sort((a, b) =>
          a.state.borrowAssetsUsd > b.state.borrowAssetsUsd ? sortDirection : -sortDirection,
        );
        break;
      case 5:
        newData.sort((a, b) =>
          a.state.supplyApy > b.state.supplyApy ? sortDirection : -sortDirection,
        );
        break;
      case 6:
        newData.sort((a, b) => (a.lltv > b.lltv ? sortDirection : -sortDirection));
        break;
    }
    setFilteredData(newData);
  }, [data, hideDust, sortColumn, sortDirection, hideUnknown, selectedCollaterals, selectedLoanAssets]);

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
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <h1 className="font-roboto py-4"> Markets </h1>
        <p className="py-4"> View all Markets </p>

        <div className="flex justify-between">
          <div className='flex gap-1'>
            {/* collateral filter */}
            <button
              type="button"
              className="bg-monarch-soft-black my-1 flex items-center justify-center gap-2 rounded-sm px-2 py-3"
              onClick={() => {
                setExpandedLoanOptions(!expanedLoanOptions);
              }}
            >
              Filter Loan {selectedLoanAssets.length === 0 ? <MixerHorizontalIcon /> : <span className='rounded-xl bg-monarch-orange px-1'>{selectedLoanAssets.length} </span>}
            </button>

            <button
              type="button"
              className="bg-monarch-soft-black my-1 flex items-center justify-center gap-2 rounded-sm px-2 py-3"
              onClick={() => {
                setExpandCollatOptions(!expandCollatOptions);
              }}
            >
              Filter Collateral {selectedCollaterals.length === 0 ? <MixerHorizontalIcon /> : <span className='rounded-xl bg-monarch-orange px-1'>{selectedCollaterals.length} </span>}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <label className="bg-monarch-soft-black my-1 flex items-center px-2 py-1 ">
              <input
                type="checkbox"
                checked={hideDust}
                onChange={(e) => setHideDust(e.target.checked)}
              />
              <p className="p-2">Hide dust</p>
            </label>

            <label className="bg-monarch-soft-black my-1 flex items-center px-2 py-1">
              <input
                type="checkbox"
                checked={hideUnknown}
                onChange={(e) => setHideUnknown(e.target.checked)}
              />
              <p className="p-2">Hide unknown</p>
            </label>
          </div>
        </div>

        {/* loan asset filter section: all option as check box */}
        {expanedLoanOptions && (
          <>
            <p className="opacity-80"> Loans </p>
            <div className="flex gap-1 overflow-auto">
              {uniqueLoanAssets.map((loanAsset) => {
                const token = supportedTokens.find((t) => t.address.toLowerCase() === loanAsset) as ERC20Token;
                if (!token) console.log(loanAsset)
                return (
                  <label
                    key={`loan-${loanAsset}`}
                    className="flex bg-monarch-soft-black items-center justify-center p-2 px-5 my-1 gap-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLoanAssets.includes(token.address.toLowerCase())}
                      onChange={() => {
                        if (selectedLoanAssets.includes(token.address.toLowerCase())) {
                          setSelectedLoanAssets(
                            selectedLoanAssets.filter((c) => c !== token.address.toLowerCase()),
                          );
                        } else {
                          setSelectedLoanAssets([
                            ...selectedLoanAssets,
                            token.address.toLowerCase(),
                          ]);
                        }
                      }}
                    />
                    <p>{token?.symbol}</p>
                    {token.img && <Image src={token.img} alt="icon" height="18"/>}
                  </label>
                );
              })}
            </div>
          </>
        )}
        
        {/* collateral filter section: all option as check box */}
        {expandCollatOptions && (
          <>
            <p className="opacity-80"> Collaterals </p>
            <div className="flex gap-1 overflow-auto">
              {uniqueCollaterals.map((collateral) => {
                const token = supportedTokens.find((t) => t.address.toLowerCase() === collateral) as ERC20Token;
                return (
                  <label
                    key={`collat-${collateral}`}
                    className="flex bg-monarch-soft-black items-center justify-center p-2 px-5 my-1 gap-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCollaterals.includes(token.address.toLowerCase())}
                      onChange={() => {
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
                    />
                    <p>{token?.symbol}</p>
                    {token.img && <Image src={token.img} alt="icon" height="18"/>}
                  </label>
                );
              })}
            </div>
          </>
        )}

        {loading ? (
          <div> Loading Morpho Blue Markets... </div>
        ) : data == null ? (
          <div> No data </div>
        ) : (
          <div className="bg-monarch-soft-black">
            <table className="font-roboto w-full">
              <thead className="table-header">
                <tr>
                  <th> Id </th>
                  <th className="hover:cursor-pointer" onClick={() => titleOnclick(1)}>
                    {' '}
                    Loan{' '}
                  </th>
                  <th className="hover:cursor-pointer" onClick={() => titleOnclick(2)}>
                    {' '}
                    Collateral{' '}
                  </th>
                  <th className="hover:cursor-pointer" onClick={() => titleOnclick(3)}>
                    {' '}
                    Total Supply{' '}
                  </th>
                  <th className="hover:cursor-pointer" onClick={() => titleOnclick(4)}>
                    {' '}
                    Total Borrow{' '}
                  </th>
                  <th className="hover:cursor-pointer" onClick={() => titleOnclick(5)}>
                    {' '}
                    APY(%){' '}
                  </th>
                  <th className="hover:cursor-pointer" onClick={() => titleOnclick(6)}>
                    {' '}
                    LLTV{' '}
                  </th>
                  <th> Actions </th>
                </tr>
              </thead>
              <tbody className="table-body text-sm">
                {filteredData.map((item, index) => {
                  const collatImg = supportedTokens.find(
                    (token) =>
                      token.address.toLowerCase() === item.collateralAsset.address.toLowerCase(),
                  )?.img;
                  const loanImg = supportedTokens.find(
                    (token) => token.address.toLowerCase() === item.loanAsset.address.toLowerCase(),
                  )?.img;

                  const collatToShow = item.collateralAsset.symbol
                    .slice(0, 6)
                    .concat(item.collateralAsset.symbol.length > 6 ? '...' : '');

                  return (
                    <tr key={index.toFixed()}>
                      {/* id */}
                      <td>
                        <div className="flex justify-center">
                          <a
                            className="group flex items-center gap-1 no-underline hover:underline"
                            href={getMarketURL(item.uniqueKey)}
                            target="_blank"
                          >
                            <p>{item.uniqueKey.slice(2, 8)} </p>
                            <p className="opacity-0 group-hover:opacity-100">
                              <ExternalLinkIcon />
                            </p>
                          </a>
                        </div>
                      </td>

                      {/* loan */}
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          {loanImg ? (
                            <Image src={loanImg} alt="icon" width="18" height="18" />
                          ) : null}
                          <a
                            className="group flex items-center gap-1 no-underline hover:underline"
                            href={getAssetURL(item.loanAsset.address)}
                            target="_blank"
                          >
                            <p> {item.loanAsset.symbol} </p>
                            <p className="opacity-0 group-hover:opacity-100">
                              <ExternalLinkIcon />
                            </p>
                          </a>
                        </div>
                      </td>

                      {/* collateral */}
                      <td>
                        <div className="flex items-center justify-center  gap-1">
                          {collatImg ? (
                            <Image src={collatImg} alt="icon" width="18" height="18" />
                          ) : null}
                          <a
                            className="group flex items-center gap-1 no-underline hover:underline"
                            href={getAssetURL(item.collateralAsset.address)}
                            target="_blank"
                          >
                            <p> {collatToShow} </p>
                            <p className="opacity-0 group-hover:opacity-100">
                              <ExternalLinkIcon />
                            </p>
                          </a>
                        </div>
                      </td>

                      {/* total supply */}
                      <td>
                        <p>${formatUSD(Number(item.state.supplyAssetsUsd)) + '   '} </p>
                        <p style={{ opacity: '0.7' }}>
                          {formatBalance(
                            item.state.supplyAssets,
                            item.loanAsset.decimals,
                          ).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) +
                            ' ' +
                            item.loanAsset.symbol}
                        </p>
                      </td>

                      {/* total supply */}
                      <td>
                        <p>${formatUSD(Number(item.state.borrowAssetsUsd))} </p>
                        <p style={{ opacity: '0.7' }}>
                          {formatBalance(
                            item.state.borrowAssets,
                            item.loanAsset.decimals,
                          ).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) +
                            ' ' +
                            item.loanAsset.symbol}
                        </p>
                      </td>

                      {/* <td> {item.loanAsset.address} </td> */}

                      <td>{(item.state.supplyApy * 100).toFixed(3)}</td>

                      <td>{Number(item.lltv) / 1e16}%</td>

                      <td>
                        <button
                          type="button"
                          aria-label="Supply"
                          style={{ padding: '3px' }}
                          className="bg-monarch-orange items-center justify-between rounded-sm text-xs opacity-70 hover:opacity-100"
                        >
                          Supply
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
