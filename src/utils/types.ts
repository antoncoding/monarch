import { Address } from 'viem';

export type MarketPosition = {
  supplyShares: string;
  supplyAssets: string;
  supplyAssetsUsd: number;
  borrowShares: string;
  borrowAssets: string;
  borrowAssetsUsd: number;
  market: Market; // Now using the full Market type
};

export type MarketPositionWithEarnings = MarketPosition & {
  earned: PositionEarnings;
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
    shares: string;
    assets: string;
    market: {
      uniqueKey: string;
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

export type RewardAmount = {
  total: string;
  claimable_now: string;
  claimable_next: string;
  claimed: string;
};

// Market Program Type
export type MarketRewardType = {
  // shared
  type: 'market-reward';
  asset: AssetType;
  user: string;
  // specific
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
};

// Uniform Reward Type
export type UniformRewardType = {
  // shared
  type: 'uniform-reward';
  asset: AssetType;
  user: string;
  // specific
  amount: RewardAmount;
  program_id: string;
};

export type VaultRewardType = {
  // shared
  type: 'vault-reward';
  asset: AssetType;
  user: string;
  // specific
  program: VaultProgramType;
  for_supply: RewardAmount | null;
};

export type VaultProgramType = {
  type: 'vault-reward';
  asset: AssetType;
  vault: string;
  chain_id: number;
  rate_per_year: string;
  distributor: AssetType;
  creator: string;
  blacklist: string[];
  start: string;
  end: string;
  created_at: string;
  id: string;
};

// Combined RewardResponseType
export type RewardResponseType = MarketRewardType | UniformRewardType | VaultRewardType;

export type AggregatedRewardType = {
  asset: AssetType;
  total: {
    claimable: bigint;
    pendingAmount: bigint;
    claimed: bigint;
  };
  programs: ('vault-reward' | 'market-reward' | 'uniform-reward')[];
};

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
  isMax: boolean;
  shares?: bigint;
};

export type PositionEarnings = {
  lifetimeEarned: string;
  last24hEarned: string | null;
  last7dEarned: string | null;
  last30dEarned: string | null;
};

export type GroupedPosition = {
  loanAsset: string;
  loanAssetAddress: string;
  loanAssetDecimals: number;
  chainId: number;
  totalSupply: number;
  totalWeightedApy: number;

  earned?: PositionEarnings;

  collaterals: {
    address: string;
    symbol: string;
    amount: number;
  }[];
  markets: MarketPositionWithEarnings[];
  processedCollaterals: {
    address: string;
    symbol: string;
    amount: number;
    percentage: number;
  }[];
  allWarnings: WarningWithDetail[];
};

// Add these new types
export type OracleFeed = {
  address: string;
  chain: {
    id: number;
  };
  description: string | null;
  id: string;
  pair: string[] | null;
  vendor: string | null;
};

export type MorphoChainlinkOracleData = {
  baseFeedOne: OracleFeed | null;
  baseFeedTwo: OracleFeed | null;
  quoteFeedOne: OracleFeed | null;
  quoteFeedTwo: OracleFeed | null;
};

// Update the Market type
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
    monthlySupplyApy: number;
    monthlyBorrowApy: number;
    dailySupplyApy: number;
    dailyBorrowApy: number;
    weeklySupplyApy: number;
    weeklyBorrowApy: number;
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
  dailyApys: {
    netSupplyApy: number;
    netBorrowApy: number;
  };

  // appended by us
  warningsWithDetail: WarningWithDetail[];
  isProtectedByLiquidationBots: boolean;
  oracle: {
    data: MorphoChainlinkOracleData;
  };
};

export type TimeseriesDataPoint = {
  x: number;
  y: number;
};

export type TimeseriesOptions = {
  startTimestamp: number;
  endTimestamp: number;
  interval: 'MINUTE' | 'HALF_HOUR' | 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL';
};

type MarketRates = {
  supplyApy: TimeseriesDataPoint[];
  borrowApy: TimeseriesDataPoint[];
  rateAtUTarget: TimeseriesDataPoint[];
  utilization: TimeseriesDataPoint[];
};

type MarketVolumes = {
  supplyAssetsUsd: TimeseriesDataPoint[];
  borrowAssetsUsd: TimeseriesDataPoint[];
  liquidityAssetsUsd: TimeseriesDataPoint[];
  supplyAssets: TimeseriesDataPoint[];
  borrowAssets: TimeseriesDataPoint[];
  liquidityAssets: TimeseriesDataPoint[];
};

export type MarketDetail = Market & {
  historicalState: MarketRates & MarketVolumes;
};

export type MarketHistoricalData = {
  rates: MarketRates;
  volumes: MarketVolumes;
};

export type MarketCap = {
  marketId: string;
  cap: string;
};

export type UserRebalancerInfo = {
  rebalancer: Address;
  marketCaps: MarketCap[];
  transactions: {
    transactionHash: string;
  }[];
};

export type AgentMetadata = {
  address: Address;
  name: string;
  strategyDescription: string;
};
