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
