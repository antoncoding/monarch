import type { Address } from 'viem';
import type { SupportedNetworks } from './networks';

export type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

export type MarketPosition = {
  state: {
    supplyShares: string;
    supplyAssets: string;
    borrowShares: string;
    borrowAssets: string;
    collateral: string;
  };
  market: Market; // Now using the full Market type
};

export type MarketPositionWithEarnings = MarketPosition & {
  earned: string;
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
  programs: ('vault-reward' | 'market-reward' | 'uniform-reward' | 'merkl')[];
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
  loanAssetSymbol: string;
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
  id: string;
  pair: string[] | null;
};

export type MorphoChainlinkOracleData = {
  baseFeedOne: OracleFeed | null;
  baseFeedTwo: OracleFeed | null;
  quoteFeedOne: OracleFeed | null;
  quoteFeedTwo: OracleFeed | null;
};

// Oracle item from Morpho API oracles query
export type OracleItem = {
  address: string;
  chain: {
    id: number;
  };
  data: MorphoChainlinkOracleData | null;
};

// Oracles query response from Morpho API
export type OraclesQueryResponse = {
  data: {
    oracles: {
      items: OracleItem[];
      pageInfo: {
        countTotal: number;
        count: number;
        limit: number;
        skip: number;
      };
    };
  };
  errors?: { message: string }[];
};

// Update the Market type
export type Market = {
  id: string;
  lltv: string;
  uniqueKey: string;
  irmAddress: string;
  oracleAddress: string;
  collateralPrice: string;
  whitelisted: boolean;
  morphoBlue: {
    id: string;
    address: string;
    chain: {
      id: number;
    };
  };
  loanAsset: TokenInfo;
  collateralAsset: TokenInfo;
  state: {
    borrowAssets: string;
    supplyAssets: string;
    borrowAssetsUsd: number;
    supplyAssetsUsd: number;
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

    // AdaptiveCurveIRM APY if utilization was at target
    apyAtTarget: number;

    // AdaptiveCurveIRM rate per second if utilization was at target
    rateAtTarget: string;
  };
  realizedBadDebt: {
    underlying: string;
  };
  supplyingVaults?: {
    address: string;
  }[];
  // whether we have USD price such has supplyUSD, borrowUSD, collateralUSD, etc. If not, use estimationP
  hasUSDPrice: boolean;
  warnings: MarketWarning[];
  oracle?: {
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
  interval: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';
};

// Export MarketRates and MarketVolumes
export type MarketRates = {
  supplyApy: TimeseriesDataPoint[];
  borrowApy: TimeseriesDataPoint[];
  apyAtTarget: TimeseriesDataPoint[];
  utilization: TimeseriesDataPoint[];
};

export type MarketVolumes = {
  supplyAssetsUsd: TimeseriesDataPoint[];
  borrowAssetsUsd: TimeseriesDataPoint[];
  liquidityAssetsUsd: TimeseriesDataPoint[];
  supplyAssets: TimeseriesDataPoint[];
  borrowAssets: TimeseriesDataPoint[];
  liquidityAssets: TimeseriesDataPoint[];
};

export type HistoricalData = {
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
  network: SupportedNetworks;
};

export type AgentMetadata = {
  address: Address;
  name: string;
  strategyDescription: string;
  image: string;
};

// Define the comprehensive Market Activity Transaction type
export type MarketActivityTransaction = {
  type: 'MarketSupply' | 'MarketWithdraw' | 'MarketBorrow' | 'MarketRepay';
  hash: string;
  timestamp: number;
  amount: string; // Unified field for assets/amount
  userAddress: string; // Unified field for user address
};

// Paginated result type for market activity transactions
export type PaginatedMarketActivityTransactions = {
  items: MarketActivityTransaction[];
  totalCount: number;
};

// Type for Liquidation Transactions (Simplified based on original hook)
export type MarketLiquidationTransaction = {
  type: 'MarketLiquidation';
  hash: string;
  timestamp: number;
  liquidator: string;
  repaidAssets: string;
  seizedAssets: string;
  badDebtAssets: string;
};

// Type for Market Supplier (current position state, not historical transactions)
// Only stores shares - assets can be calculated from shares using market state
export type MarketSupplier = {
  userAddress: string;
  supplyShares: string;
};

// Paginated result type for market suppliers
export type PaginatedMarketSuppliers = {
  items: MarketSupplier[];
  totalCount: number;
};

// Type for Market Borrower (current position state, not historical transactions)
// Stores borrowAssets and collateral - shares can be calculated if needed
export type MarketBorrower = {
  userAddress: string;
  borrowAssets: string;
  collateral: string;
};

// Paginated result type for market borrowers
export type PaginatedMarketBorrowers = {
  items: MarketBorrower[];
  totalCount: number;
};
