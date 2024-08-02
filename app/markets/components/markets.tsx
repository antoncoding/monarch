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
import { SupportedNetworks, getNetworkImg, isSupportedChain, networks } from '@/utils/networks';
import * as keys from '@/utils/storageKeys';
import {
  supportedTokens,
  ERC20Token,
  isWhitelisted,
  findTokenWithKey,
  infoToKey,
} from '@/utils/tokens';

import MarketsTable from './marketsTable';
import { SupplyModal } from './supplyModal';

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
      // filter ERC20Token objects that exist in markets list
      const collaterals = supportedTokens.filter((token) => {
        return data.find((market) =>
          token.networks.find(
            (network) =>
              network.address.toLowerCase() === market.collateralAsset.address.toLowerCase() &&
              network.chain.id === market.morphoBlue.chain.id,
          ),
        );
      });

      const loanAssets = supportedTokens.filter((token) => {
        return data.find((market) =>
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
  }, [data]);

  // Update the filter effect toLowerCase() also filter based on the checkbox
  useEffect(() => {
    let newData = [...data];

    if (selectedNetwork !== null) {
      newData = newData.filter((item) => item.morphoBlue.chain.id === selectedNetwork);
    }

    if (hideDust) {
      newData = newData
        .filter((item) => Number(item.state.supplyAssetsUsd) > 1000)
        .filter((item) => Number(item.state.borrowAssetsUsd) > 100);
    }

    if (hideUnknown) {
      newData = newData
        // Filter out any items which's collateral are not in the supported tokens list
        // Filter out any items which's loan are not in the supported tokens list
        .filter((item) => isWhitelisted(item.collateralAsset.address, item.morphoBlue.chain.id))
        .filter((item) => isWhitelisted(item.loanAsset.address, item.morphoBlue.chain.id));
    }

    if (selectedCollaterals.length > 0) {
      newData = newData.filter((item) =>
        selectedCollaterals.find((combinedKey) =>
          combinedKey
            .split('|')
            .includes(`${item.collateralAsset.address.toLowerCase()}-${item.morphoBlue.chain.id}`),
        ),
      );
    }

    if (selectedLoanAssets.length > 0) {
      newData = newData.filter((item) =>
        selectedLoanAssets.find((combinedKey) =>
          combinedKey
            .split('|')
            .includes(`${item.loanAsset.address.toLowerCase()}-${item.morphoBlue.chain.id}`),
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
            <Select
              label="Network"
              selectionMode="single"
              placeholder="All networks"
              onChange={(e) => {
                if (!e.target.value) setSelectedNetwork(null);
                const newId = Number(e.target.value);
                if (newId && isSupportedChain(newId)) {
                  setSelectedNetwork(newId);
                }
              }}
              classNames={{
                trigger: 'bg-secondary rounded-sm min-w-32',
                popoverContent: 'bg-secondary rounded-sm',
              }}
              items={networks}
              renderValue={(items) => {
                return (
                  <div className="flex-scroll flex gap-1">
                    {items.map((item) => {
                      const networkImg = getNetworkImg(Number(item.key));
                      return networkImg ? (
                        <Image src={networkImg} alt="icon" height="18" />
                      ) : (
                        item.textValue
                      );
                    })}
                  </div>
                );
              }}
            >
              {networks.map((network) => {
                // key = `0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-1|0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-42`
                return (
                  <SelectItem key={network.network} textValue={network.name}>
                    <div className="flex items-center justify-between">
                      <p>{network.name}</p>
                      <Image className="ml-auto" src={network.logo} alt="icon" height="18" />
                    </div>
                  </SelectItem>
                );
              })}
            </Select>

            <Select
              label="Loan Asset"
              selectionMode="multiple"
              placeholder="All loan asset"
              selectedKeys={selectedLoanAssets}
              onChange={(e) => {
                if (!e.target.value) setSelectedLoanAssets([]);
                else setSelectedLoanAssets((e.target.value as string).split(','));
              }}
              classNames={{
                trigger: 'bg-secondary rounded-sm min-w-48',
                popoverContent: 'bg-secondary rounded-sm',
              }}
              items={uniqueLoanAssets}
              // className='w-48 rounded-sm'
              isLoading={loading}
              renderValue={(items) => {
                return (
                  <div className="flex-scroll flex gap-1">
                    {items.map((item) => {
                      const token = findTokenWithKey(item.key as string);
                      return token?.img ? (
                        <Image src={token.img} alt="icon" height="18" />
                      ) : (
                        item.textValue
                      );
                    })}
                  </div>
                );
              }}
            >
              <SelectSection title="Choose loan assets">
                {uniqueLoanAssets.map((token) => {
                  // key = `0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-1|0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-42`
                  const key = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
                  return (
                    <SelectItem key={key} textValue={token.symbol}>
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
                if (!e.target.value) setSelectedCollaterals([]);
                else setSelectedCollaterals((e.target.value as string).split(','));
              }}
              classNames={{
                trigger: 'bg-secondary rounded-sm min-w-48',
                popoverContent: 'bg-secondary rounded-sm',
              }}
              items={uniqueCollaterals}
              isLoading={loading}
              renderValue={(items) => {
                return (
                  <div className="flex-scroll flex gap-1">
                    {items.map((item) => {
                      const token = findTokenWithKey(item.key as string);
                      return token?.img ? (
                        <Image src={token.img} alt="icon" height="18" />
                      ) : (
                        item.textValue
                      );
                    })}
                  </div>
                );
              }}
            >
              <SelectSection title="Choose collateral assets">
                {uniqueCollaterals.map((token) => {
                  // key = `0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-1|0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-42`
                  const key = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
                  return (
                    <SelectItem key={key} textValue={token.symbol}>
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
          <div className="my-2 flex items-center justify-start rounded-sm p-2 lg:justify-end">
            <Checkbox
              classNames={{
                base: 'bg-secondary items-center cursor-pointer rounded-sm p-3',
              }}
              isSelected={hideDust}
              onValueChange={(checked: boolean) => {
                setHideDust(checked);
                storage.setItem(keys.MarketsHideDustKey, checked.toString());
              }}
              size="sm"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-default-500"> Hide Dust </span>
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
                <span className="text-sm text-default-500"> Hide Unknown </span>
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
          <div className="max-w-screen mt-4 overflow-auto bg-secondary">
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
