import { SupportedNetworks } from '@/utils/networks';
import { isWhitelisted } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { SortColumn } from './constants';
import { parseOracleVendors } from '@/utils/oracle';

export const sortProperties = {
  [SortColumn.LoanAsset]: 'loanAsset.name',
  [SortColumn.CollateralAsset]: 'collateralAsset.name',
  [SortColumn.LLTV]: 'lltv',
  [SortColumn.Reward]: (item: Market) => Number(item.rewardPer1000USD ?? '0'),
  [SortColumn.Supply]: 'state.supplyAssetsUsd',
  [SortColumn.Borrow]: 'state.borrowAssetsUsd',
  [SortColumn.SupplyAPY]: 'state.supplyApy',
};

export const getNestedProperty = (obj: Market, path: string | ((item: Market) => number)) => {
  if (typeof path === 'function') {
    return path(obj);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/prefer-optional-chain
  return path.split('.').reduce((acc, part) => acc && acc[part], obj as any);
};

const isSelectedAsset = (
  market: Market,
  selectedAssetKeys: string[],
  type: 'collateral' | 'loan',
) => {
  return selectedAssetKeys.find((combinedKey) =>
    combinedKey
      .split('|')
      .includes(
        `${(type === 'collateral'
          ? market.collateralAsset
          : market.loanAsset
        ).address.toLowerCase()}-${market.morphoBlue.chain.id}`,
      ),
  );
};

export function applyFilterAndSort(
  markets: Market[],
  sortColumn: SortColumn,
  sortDirection: number,
  selectedNetwork: SupportedNetworks | null,
  showUnknown: boolean,
  showUnknownOracle: boolean,
  selectedCollaterals: string[],
  selectedLoanAssets: string[],
) {
  let newData = [...markets];

  if (selectedNetwork !== null) {
    newData = newData.filter((item) => item.morphoBlue.chain.id === selectedNetwork);
  }

  if (!showUnknown) {
    newData = newData
      // Filter out any items which's collateral are not in the supported tokens list
      // Filter out any items which's loan are not in the supported tokens list
      .filter((item) => isWhitelisted(item.collateralAsset.address, item.morphoBlue.chain.id))
      .filter((item) => isWhitelisted(item.loanAsset.address, item.morphoBlue.chain.id));
  }

  if (!showUnknownOracle) {
    newData = newData.filter((item) => {
      const { vendors } = parseOracleVendors(item.oracle.data);
      return vendors.length > 0;
    });
  }

  if (selectedCollaterals.length > 0) {
    newData = newData.filter((item) => isSelectedAsset(item, selectedCollaterals, 'collateral'));
  }

  if (selectedLoanAssets.length > 0) {
    newData = newData.filter((item) => isSelectedAsset(item, selectedLoanAssets, 'loan'));
  }

  newData.sort((a, b) => {
    // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
    const propertyA = getNestedProperty(a, sortProperties[sortColumn]);

    // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
    const propertyB = getNestedProperty(b, sortProperties[sortColumn]);

    return propertyA > propertyB ? sortDirection : -sortDirection;
  });

  return newData;
}
