import type { Address } from 'viem';

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
  maximumLTV: string;
  liquidationThreshold: string;
  liquidationPenalty: string;
  createdTimestamp: string;
  createdBlockNumber: string;
  lltv: string;
  irm: Address;
  inputToken: SubgraphToken;
  inputTokenPriceUSD: string; // BigDecimal (collateralPrice)
  borrowedToken: SubgraphToken; // loanAsset

  // note: these 2 are weird
  variableBorrowedTokenBalance: string | null; // updated as total Borrowed
  inputTokenBalance: string; // updated as total Supply

  totalValueLockedUSD: string;
  totalDepositBalanceUSD: string;
  totalBorrowBalanceUSD: string;
  totalSupplyShares: string;
  totalBorrowShares: string; // BigInt (borrowShares)

  totalSupply: string;
  totalBorrow: string;
  totalCollateral: string;

  lastUpdate: string;
  reserves: string;
  reserveFactor: string;
  fee: string;
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
