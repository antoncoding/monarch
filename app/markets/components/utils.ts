/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { SupportedNetworks } from '@/utils/networks';
import { parsePriceFeedVendors, PriceFeedVendors } from '@/utils/oracle';
import { ERC20Token } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { SortColumn } from './constants';

export const sortProperties = {
  [SortColumn.Starred]: 'uniqueKey',
  [SortColumn.LoanAsset]: 'loanAsset.name',
  [SortColumn.CollateralAsset]: 'collateralAsset.name',
  [SortColumn.LLTV]: 'lltv',
  [SortColumn.Supply]: 'state.supplyAssetsUsd',
  [SortColumn.Borrow]: 'state.borrowAssetsUsd',
  [SortColumn.SupplyAPY]: 'state.supplyApy',
};

export const getNestedProperty = (obj: Market, path: string | ((item: Market) => number)) => {
  if (typeof path === 'function') {
    return path(obj);
  }

  if (!path) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

// Define the type for USD Filters
type UsdFilters = {
  minSupply: string;
  minBorrow: string;
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
  selectedOracles: PriceFeedVendors[],
  staredIds: string[],
  findToken: (address: string, chainId: number) => ERC20Token | undefined,
  usdFilters: UsdFilters,
): Market[] {
  const parseUsdValue = (value: string | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  };

  const minSupplyUsd = parseUsdValue(usdFilters.minSupply);
  const minBorrowUsd = parseUsdValue(usdFilters.minBorrow);

  return markets
    .filter((market) => {
      if (selectedNetwork !== null && market.morphoBlue.chain.id !== selectedNetwork) {
        return false;
      }

      // todo: might need async function to search for tokens from API.
      const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);
      const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);

      if (!showUnknown && (!collateralToken || !loanToken)) {
        return false;
      }

      if (
        !showUnknownOracle &&
        (!market.oracle || parsePriceFeedVendors(market.oracle.data).isUnknown)
      ) {
        return false;
      }

      if (
        (selectedCollaterals.length > 0 &&
          !isSelectedAsset(market, selectedCollaterals, 'collateral')) ||
        (selectedLoanAssets.length > 0 && !isSelectedAsset(market, selectedLoanAssets, 'loan'))
      ) {
        return false;
      }

      if (selectedOracles.length > 0 && !!market.oracle) {
        const marketOracles = parsePriceFeedVendors(market.oracle.data).vendors;
        if (!marketOracles.some((oracle) => selectedOracles.includes(oracle))) {
          return false;
        }
      }

      // Add USD Filters
      const supplyUsd = parseUsdValue(market.state?.supplyAssetsUsd?.toString()); // Use optional chaining
      const borrowUsd = parseUsdValue(market.state?.borrowAssetsUsd?.toString()); // Use optional chaining

      if (minSupplyUsd !== null && (supplyUsd === null || supplyUsd < minSupplyUsd)) {
        return false;
      }
      if (minBorrowUsd !== null && (borrowUsd === null || borrowUsd < minBorrowUsd)) {
        return false;
      }
      // End USD Filters

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortColumn === SortColumn.Starred) {
        const aStared = staredIds.includes(a.uniqueKey);
        const bStared = staredIds.includes(b.uniqueKey);
        if (aStared && !bStared) return -1;
        if (!aStared && bStared) return 1;
        return 0;
      } else {
        const property = sortProperties[sortColumn];
        if (!property) {
          return 0;
        }

        const aValue = getNestedProperty(a, property);
        const bValue = getNestedProperty(b, property);
        comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
      return comparison * sortDirection;
    });
}
