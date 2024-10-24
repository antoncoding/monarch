/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { SupportedNetworks } from '@/utils/networks';
import { parseOracleVendors, OracleVendors } from '@/utils/oracle';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { SortColumn } from './constants';

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
  selectedOracles: OracleVendors[],
): Market[] {
  return markets
    .filter((market) => {
      if (selectedNetwork !== null && market.morphoBlue.chain.id !== selectedNetwork) {
        return false;
      }

      const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);
      const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);

      if (!showUnknown && (!collateralToken || !loanToken)) {
        return false;
      }

      if (!showUnknownOracle && parseOracleVendors(market.oracle.data).isUnknown) {
        return false;
      }

      if (selectedCollaterals.length > 0) {
        return isSelectedAsset(market, selectedCollaterals, 'collateral');
      }

      if (selectedLoanAssets.length > 0) {
        return isSelectedAsset(market, selectedLoanAssets, 'loan');
      }

      if (selectedOracles.length > 0) {
        const marketOracles = parseOracleVendors(market.oracle.data).vendors;
        if (!marketOracles.some((oracle) => selectedOracles.includes(oracle))) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      const property = sortProperties[sortColumn];
      if (property) {
         
        const aValue = getNestedProperty(a, property);
         
        const bValue = getNestedProperty(b, property);
        comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
      return comparison * sortDirection;
    });
}
