import type { Address } from 'viem';

export type SubgraphToken = {
  id: Address;
  name: string;
  symbol: string;
  decimals: number;
  lastPriceUSD: string | null;
};

export type SubgraphOracle = {
  id: string;
  oracleAddress: Address;
  oracleSource: string | null;
  isActive: boolean;
  isUSD: boolean;
};

export type SubgraphInterestRate = {
  id: string;
  rate: string;
  side: 'LENDER' | 'BORROWER';
  type: 'STABLE' | 'VARIABLE' | 'FIXED';
};

export type SubgraphProtocolInfo = {
  id: string;
  network: string;
  protocol: string;
};

export type SubgraphMarket = {
  id: Address;
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
  borrowedToken: SubgraphToken;
  variableBorrowedTokenBalance: string | null;
  inputTokenBalance: string;

  totalValueLockedUSD: string;
  totalDepositBalanceUSD: string;
  totalBorrowBalanceUSD: string;
  totalSupplyShares: string;
  totalBorrowShares: string;

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

export type SubgraphMarketsQueryResponse = {
  data: {
    markets: SubgraphMarket[];
  };
  errors?: { message: string }[];
};

export type SubgraphMarketQueryResponse = {
  data: {
    market: SubgraphMarket | null;
  };
  errors?: { message: string }[];
};
