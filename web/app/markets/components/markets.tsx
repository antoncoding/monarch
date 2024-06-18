/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Checkbox, Select, SelectItem, SelectSection, Tooltip } from '@nextui-org/react';
import storage from 'local-storage-fallback';
import Image from 'next/image';
import { Toaster } from 'react-hot-toast';
import { BsQuestionCircle } from 'react-icons/bs';
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

  // Add state for the selected collateral and loan asset
  const [selectedCollaterals, setSelectedCollaterals] = useState<Set<string>>(new Set<string>());
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<Set<string>>(new Set<string>());

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

    if (selectedCollaterals.size > 0) {
      newData = newData.filter((item) =>
        selectedCollaterals.has(item.collateralAsset.address.toLowerCase()),
      );
    }

    if (selectedLoanAssets.size > 0) {
      newData = newData.filter((item) =>
        selectedLoanAssets.has(item.loanAsset.address.toLowerCase()),
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
    <div className="flex flex-col justify-between pb-4 font-zen">
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

        <div className="flex justify-between">
          {/* left section: asset filters */}
          <div className="flex gap-2">
            <Select
              label="Loan Asset"
              selectionMode="multiple"
              placeholder="All loan asset"
              selectedKeys={selectedLoanAssets}
              onChange={(e) => {
                if (!e.target.value) setSelectedLoanAssets(new Set());
                else setSelectedLoanAssets(new Set((e.target.value as string).split(',')));
              }}
              classNames={{
                trigger: 'bg-secondary rounded-sm min-w-48',
                popoverContent: 'bg-secondary rounded-sm',
              }}
              // className='w-48 rounded-sm'
              isLoading={loading}
              renderValue={(items) => {
                return (
                  <div className="flex-scroll flex gap-1">
                    {(items as { key: string }[]).map((item) => {
                      const token = supportedTokens.find(
                        (t) => t.address.toLowerCase() === item.key,
                      ) as ERC20Token;
                      if (!token) return null;
                      return token.img ? (
                        <Image src={token.img} alt="icon" height="18" />
                      ) : (
                        token.symbol
                      );
                    })}
                  </div>
                );
              }}
            >
              <SelectSection title="Choose loan assets">
                {uniqueLoanAssets.map((asset) => {
                  const token = supportedTokens.find(
                    (t) => t.address.toLowerCase() === asset,
                  ) as ERC20Token;

                  return (
                    <SelectItem key={asset}>
                      <div className="flex items-center justify-between">
                        <p>{token?.symbol}</p>
                        {token.img && <Image src={token.img} alt="icon" height="18" />}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectSection>
            </Select>

            {/* collateral  */}
            <Select
              label="Collateral Asset"
              selectionMode="multiple"
              placeholder="All collateral asset"
              selectedKeys={selectedCollaterals}
              onChange={(e) => {
                if (!e.target.value) setSelectedCollaterals(new Set());
                else setSelectedCollaterals(new Set((e.target.value as string).split(',')));
              }}
              classNames={{
                trigger: 'bg-secondary rounded-sm min-w-48',
                popoverContent: 'bg-secondary rounded-sm',
              }}
              isLoading={loading}
              renderValue={(items) => {
                return (
                  <div className="flex flex-grow gap-1 ">
                    {(items as { key: string }[]).map((item) => {
                      const token = supportedTokens.find(
                        (t) => t.address.toLowerCase() === item.key,
                      ) as ERC20Token;
                      if (!token) return null;
                      return token.img ? (
                        <Image src={token.img} alt="icon" height="18" />
                      ) : (
                        token.symbol
                      );
                    })}
                  </div>
                );
              }}
            >
              <SelectSection title="Choose collateral assets">
                {uniqueCollaterals.map((asset) => {
                  const token = supportedTokens.find(
                    (t) => t.address.toLowerCase() === asset,
                  ) as ERC20Token;

                  return (
                    <SelectItem key={asset}>
                      <div className="flex items-center justify-between">
                        <p>{token?.symbol}</p>
                        {token.img && <Image src={token.img} alt="icon" height="18" />}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectSection>
            </Select>
          </div>

          {/* right section: checkbox */}
          <div className="flex items-center justify-end rounded-sm">
            <Checkbox
              classNames={{
                base: 'inline-flex bg-secondary items-center cursor-pointer rounded-sm p-3 m-1',
              }}
              isSelected={hideDust}
              onValueChange={(checked: boolean) => {
                setHideDust(checked);
                storage.setItem(keys.MarketsHideDustKey, checked.toString());
              }}
              size="sm"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-base text-default-500"> Hide Dust </span>
                <Tooltip content="Hide markets with lower than $1000 supplied">
                  <div>
                    <BsQuestionCircle className="text-default-500" />
                  </div>
                </Tooltip>
              </div>
            </Checkbox>

            <Checkbox
              classNames={{
                base: 'inline-flex bg-secondary items-center cursor-pointer rounded-sm m-1 p-3',
              }}
              isSelected={hideUnknown}
              onValueChange={(checked: boolean) => {
                setHideUnknown(checked);
                storage.setItem(keys.MarketsHideUnknownKey, checked.toString());
              }}
              size="sm"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-base text-default-500"> Hide Unknown </span>
                <Tooltip content="Hide markets with unknown assets">
                  <div>
                    <BsQuestionCircle className="text-default-500" />
                  </div>
                </Tooltip>
              </div>
            </Checkbox>
          </div>
        </div>

        {loading ? (
          <div className="py-3 opacity-70"> Loading Morpho Blue Markets... </div>
        ) : data == null ? (
          <div> No data </div>
        ) : (
          <div className="mt-4 bg-secondary">
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
