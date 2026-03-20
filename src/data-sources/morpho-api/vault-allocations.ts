export type VaultAllocationMarket = {
  uniqueKey: string;
  loanAsset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  collateralAsset: {
    address: string;
    symbol: string;
    decimals: number;
  } | null;
  oracle: {
    address: string;
  } | null;
  irmAddress: string;
  lltv: string;
  state: {
    supplyAssets: string;
    borrowAssets: string;
    liquidityAssets: string;
  };
};

export type VaultAllocation = {
  market: VaultAllocationMarket;
  supplyAssets: string;
  supplyCap: string;
};
