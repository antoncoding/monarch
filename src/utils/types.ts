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
    oracleFeed?: OracleFeedsInfo;
    oracleInfo: {
      type: string;
    };
    irmAddress: string;
    morphoBlue: {
      id: string;
      address: string;
      chain: {
        id: number;
      };
    };
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
      borrowAssets: string;
      borrowAssetsUsd: number;
      rewards: {
        yearlySupplyTokens: string;
        asset: {
          address: string;
          priceUsd: string | null;
          spotPriceEth: string | null;
        };
      }[];
      utilization: number;
    };
  };
};

export enum UserTxTypes {
  MarketBorrow = 'MarketBorrow',
  MarketLiquidation = 'MarketLiquidation',
  MarketRepay = 'MarketRepay',
  MarketSupply = 'MarketSupply',
  MarketSupplyCollateral = 'MarketSupplyCollateral',
  MarketWithdraw = 'MarketWithdraw',
  MarketWithdrawCollateral = 'MarketWithdrawCollateral',
}

export type UserTransaction = {
  hash: string;
  timestamp: number;
  type: UserTxTypes;
  data: {
    __typename: UserTxTypes;
    assetsUsd: number;
    shares: string;
    assets: string;
    market: {
      id: string;
      uniqueKey: string;
      morphoBlue: {
        chain: {
          id: number;
        };
      };
      loanAsset: {
        id: string;
        address: string;
        decimals: number;
        symbol: string;
      };
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

export type MarketWarning = {
  type: string;
  level: string;
  __typename: string;
};

export type WarningWithDetail = {
  code: string;
  description: string;
  category: WarningCategory;
  level: string;
};

export enum WarningCategory {
  asset = 'asset',
  oracle = 'oracle',
  debt = 'debt',
  general = 'general',
}

export type TokenInfo = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number;
};

// Common types
type AssetType = {
  id: string;
  address: string;
  chain_id: number;
};

type RewardAmount = {
  total: string;
  claimable_now: string;
  claimable_next: string;
  claimed: string;
};

// Market Program Type
export type MarketProgramType = {
  type: 'market-reward';
  asset: AssetType;
  for_borrow: RewardAmount | null;
  for_collateral: RewardAmount | null;
  for_supply: RewardAmount | null;
  program: {
    creator: string;
    start: string;
    end: string;
    created_at: string;
    blacklist: string[];
    market_id: string;
    asset: AssetType;
  };
  user: string;
};

// Uniform Reward Type
export type UniformRewardType = {
  type: 'uniform-reward';
  amount: RewardAmount;
  asset: AssetType;
  program_id: string;
  user: string;
};

// Combined RewardResponseType
export type RewardResponseType = MarketProgramType | UniformRewardType;

export type RebalanceAction = {
  fromMarket: {
    loanToken: string;
    collateralToken: string;
    oracle: string;
    irm: string;
    lltv: string;
    uniqueKey: string;
  };
  toMarket: {
    loanToken: string;
    collateralToken: string;
    oracle: string;
    irm: string;
    lltv: string;
    uniqueKey: string;
  };
  amount: bigint;
};

export type GroupedPosition = {
  loanAsset: string;
  loanAssetAddress: string;
  loanAssetDecimals: number;
  chainId: number;
  totalSupply: number;
  totalWeightedApy: number;
  collaterals: { address: string; symbol: string | undefined; amount: number }[];
  markets: MarketPosition[];
  processedCollaterals: {
    address: string;
    symbol: string | undefined;
    amount: number;
    percentage: number;
  }[];
};

// Add this type to the existing types in the file
export type Market = {
  id: string;
  lltv: string;
  uniqueKey: string;
  irmAddress: string;
  oracleAddress: string;
  collateralPrice: string;
  morphoBlue: {
    id: string;
    address: string;
    chain: {
      id: number;
    };
  };
  oracleInfo: {
    type: string;
  };
  oracleFeed?: OracleFeedsInfo;
  loanAsset: TokenInfo;
  collateralAsset: TokenInfo;
  state: {
    borrowAssets: string;
    supplyAssets: string;
    borrowAssetsUsd: string;
    supplyAssetsUsd: string;
    borrowShares: string;
    supplyShares: string;
    liquidityAssets: string;
    liquidityAssetsUsd: number;
    collateralAssets: string;
    collateralAssetsUsd: number | null;
    utilization: number;
    supplyApy: number;
    borrowApy: number;
    fee: number;
    timestamp: number;
    rateAtUTarget: number;
    rewards: {
      yearlySupplyTokens: string;
      asset: {
        address: string;
        priceUsd: string | null;
        spotPriceEth: string | null;
      };
      amountPerSuppliedToken: string;
      amountPerBorrowedToken: string;
    }[];
  };
  warnings: MarketWarning[];
  badDebt?: {
    underlying: number;
    usd: number;
  };
  realizedBadDebt?: {
    underlying: number;
    usd: number;
  };

  // appended by us
  rewardPer1000USD?: string;
  warningsWithDetail: WarningWithDetail[];
  isProtectedByLiquidationBots: boolean;
};
