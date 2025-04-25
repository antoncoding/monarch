import { Address } from 'viem';

// Corresponds to tokenFragment
export type SubgraphToken = {
  id: Address; // address
  name: string;
  symbol: string;
  decimals: number;
  lastPriceUSD: string | null; // BigDecimal represented as string
};

// Corresponds to oracleFragment
export type SubgraphOracle = {
  id: string;
  oracleAddress: Address;
  oracleSource: string | null;
  isActive: boolean;
  isUSD: boolean;
};

// Corresponds to InterestRate type within marketFragment
export type SubgraphInterestRate = {
  id: string;
  rate: string; // BigDecimal represented as string (APY percentage)
  side: 'LENDER' | 'BORROWER';
  type: 'STABLE' | 'VARIABLE' | 'FIXED';
};

// Corresponds to protocol details within marketFragment
export type SubgraphProtocolInfo = {
  id: string;
  network: string; // e.g., "MAINNET", "BASE"
  protocol: string; // e.g., "Morpho Blue"
};

// Corresponds to the main marketFragment (SubgraphMarketFields)
export type SubgraphMarket = {
  id: Address; // uniqueKey (market address)
  name: string;
  isActive: boolean;
  canBorrowFrom: boolean;
  canUseAsCollateral: boolean;
  maximumLTV: string; // BigDecimal
  liquidationThreshold: string; // BigDecimal
  liquidationPenalty: string; // BigDecimal
  createdTimestamp: string; // BigInt
  createdBlockNumber: string; // BigInt
  lltv: string; // BigInt
  irm: Address; // irmAddress
  inputToken: SubgraphToken; // collateralAsset
  inputTokenBalance: string; // BigInt (native collateral amount)
  inputTokenPriceUSD: string; // BigDecimal (collateralPrice)
  borrowedToken: SubgraphToken; // loanAsset
  variableBorrowedTokenBalance: string | null; // BigInt (native borrow amount)
  totalValueLockedUSD: string; // BigDecimal (collateralAssetsUsd?)
  totalDepositBalanceUSD: string; // BigDecimal (supplyAssetsUsd)
  totalBorrowBalanceUSD: string; // BigDecimal (borrowAssetsUsd)
  totalSupplyShares: string; // BigInt (supplyShares)
  totalBorrowShares: string; // BigInt (borrowShares)
  totalSupply: string; // BigInt (supplyAssets)
  totalBorrow: string; // BigInt (borrowAssets)
  lastUpdate: string; // BigInt (timestamp)
  reserves: string; // BigDecimal
  reserveFactor: string; // BigDecimal
  fee: string; // BigInt (basis points?)
  oracle: SubgraphOracle;
  rates: SubgraphInterestRate[];
  protocol: SubgraphProtocolInfo;
};

// Type for the GraphQL response structure using marketsQuery
export type SubgraphMarketsQueryResponse = {
  data: {
    markets: SubgraphMarket[];
  };
  errors?: { message: string }[];
};

// Type for a single market response (if we adapt query later)
export type SubgraphMarketQueryResponse = {
  data: {
    market: SubgraphMarket | null;
  };
  errors?: { message: string }[];
};
