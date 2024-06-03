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
    oracleAddress: string;
    irmAddress: string;
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
      supplyAssetsUsd: number;
      rewards: {
        yearlySupplyTokens: string;
        asset: {
          address: string;
          priceUsd: string | null;
          spotPriceEth: string | null;
        };
      }[];
    };
  };
  rewardPerYear: string | null;
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

export type OracleFeedsInfo = {
  baseFeedOneAddress: string;
  baseFeedOneDescription: string | null;
  baseFeedTwoAddress: string;
  baseFeedTwoDescription: string | null;
  quoteFeedOneAddress: string;
  quoteFeedOneDescription: string | null;
  quoteFeedTwoAddress: string;
  quoteFeedTwoDescription: string | null;
  baseVault: string;
  baseVaultDescription: string | null;
  baseVaultVendor: string | null;
  quoteVault: string;
  quoteVaultDescription: string | null;
  quoteVaultVendor: string | null;
  __typename: string;
};
