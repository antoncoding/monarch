'use client';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Header from '@/components/layout/header/Header';
import useMarkets from '@/hooks/useMarkets';

import { formatUSD, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/morpho';
import { supportedTokens } from '@/utils/tokens';

const allSupportedAddresses = supportedTokens.map((token) => token.address.toLowerCase());

/**
 * Use the page component to wrap the components
 * that you want to render on the page.
 */
export default function HomePage() {
  const { loading, data } = useMarkets();
  const [filter, setFilter] = useState('');

  console.log(
    'data',
    data.find(
      (m) => m.uniqueKey === '0x698fe98247a40c5771537b5786b2f3f9d78eb487b4ce4d75533cd0e94d88a115',
    ),
  );

  // Add state for the checkbox
  const [hideDust, setHideDust] = useState(true);
  const [hideUnknown, setHideUnknown] = useState(false);

  // Add state for the sort column and direction
  const [sortColumn, setSortColumn] = useState(3);
  const [sortDirection, setSortDirection] = useState(-1);

  const [filteredData, setFilteredData] = useState(data);

  // Update the filter effect to also filter based on the checkbox
  useEffect(() => {
    let newData = data;
    if (filter) {
      newData = newData.filter((item) =>
        item.collateralAsset.symbol.toLowerCase().includes(filter.toLowerCase()),
      );
    }
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
  }, [data, filter, hideDust, sortColumn, sortDirection, hideUnknown]);

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

        <div className="flex justify-between">
          <p className="py-4"> View all Morpho Blue markets </p>
          {
            /* <input
            className="bg-opacity-20 p-2"
            type="text"
            placeholder="Search for an asset"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ textAlign: 'left', borderRadius: '5px' }}
          /> */
            <div className="flex justify-end gap-2 items-center">
              <label className="bg-monarch-soft-black flex items-center px-2 py-1 my-1 ">
                <input
                  type="checkbox"
                  checked={hideDust}
                  onChange={(e) => setHideDust(e.target.checked)}
                />
                <p className="p-2">Hide dust</p>
              </label>

              <label className="bg-monarch-soft-black flex items-center px-2 py-1 my-1">
                <input
                  type="checkbox"
                  checked={hideUnknown}
                  onChange={(e) => setHideUnknown(e.target.checked)}
                />
                <p className="p-2">Hide unknown</p>
              </label>
            </div>
          }
        </div>
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
                            className="flex items-center no-underline hover:underline gap-1 group"
                            href={getMarketURL(item.uniqueKey)}
                            target="_blank"
                          >
                            <p>{item.uniqueKey.slice(2, 8)} </p>
                            <p className='opacity-0 group-hover:opacity-100'><ExternalLinkIcon/></p>
                          </a>
                        </div>
                      </td>

                      {/* loan */}
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          {loanImg ? (
                            <Image src={loanImg} alt="icon" width="18" height="18" />
                          ) : null}
                          {item.loanAsset.symbol}
                        </div>
                      </td>

                      {/* collateral */}
                      <td>
                        <div className="flex items-center justify-center  gap-1">
                          {collatImg ? (
                            <Image src={collatImg} alt="icon" width="18" height="18" />
                          ) : null}
                          <span>{collatToShow}</span>
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
