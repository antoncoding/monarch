export type MarketPosition = {
  supplyShares: string;
  supplyAssets: string;
  supplyAssetsUsd: number;
  borrowShares: string;
  borrowAssets: string;
  borrowAssetsUsd: number;
  market: {
    id: string;
    uniqueKey: string;
    lltv: string;
    dailyApys: {
      netSupplyApy: number;
    };
    weeklyApys: {
      netSupplyApy: number;
    };
    monthlyApys: {
      netSupplyApy: number;
    };
    loanAsset: {
      address: string;
      symbol: string;
      decimals: number;
    };
    collateralAsset: {
      address: string;
      symbol: string;
      decimals: number;
    };
    state: {
      liquidityAssets: string;
      supplyAssets: string;
    };
  };
};


export type WhitelistMarketResponse = {
  mainnet: {
    markets: {
      label: string;
      id: string;
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: string;
    }[];
  };
};