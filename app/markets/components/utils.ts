import { Market } from "@/hooks/useMarkets";
import { SupportedNetworks } from "@/utils/networks";
import { isWhitelisted } from "@/utils/tokens";
import { SortColumn } from "./constants";

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

export function applyFilterAndSort(
  markets: Market[], 
  sortColumn: SortColumn, 
  sortDirection: number,
  selectedNetwork: SupportedNetworks | null,
  hideDust: boolean,
  hideUnknown: boolean,
  selectedCollaterals: string[],
  selectedLoanAssets: string[],
) {
  let newData = [...markets];

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

  newData.sort((a, b) => {

    // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment 
    const propertyA = getNestedProperty(a, sortProperties[sortColumn]);
    
    // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment 
    const propertyB = getNestedProperty(b, sortProperties[sortColumn]);

    return propertyA > propertyB ? sortDirection : -sortDirection;
  });

  return newData;
}