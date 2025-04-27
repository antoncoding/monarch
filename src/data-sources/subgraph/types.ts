import { Address } from 'viem';

type SubgraphAsset = {
  id: string; // Asset address
  symbol?: string; // Optional symbol
  decimals?: number; // Optional decimals
};

type SubgraphMarketReference = {
  id: string; // Market unique key
};

type SubgraphAccountReference = {
  id: Address;
};

type SubgraphBaseTx = {
  id: string; // Transaction ID (e.g., hash + log index)
  hash: string; // Transaction hash
  timestamp: string; // Timestamp string (needs conversion to number)
  market: SubgraphMarketReference; // Reference to the market
  asset: SubgraphAsset; // Reference to the asset involved
  amount: string; // Amount of the asset (loan/collateral)
  shares: string; // Amount in shares
  accountActor?: SubgraphAccountReference; // Optional: msg.sender for deposits etc.
};

export type SubgraphDepositTx = SubgraphBaseTx & {
  isCollateral: boolean; // True for SupplyCollateral, False for Supply
};

export type SubgraphWithdrawTx = SubgraphBaseTx & {
  isCollateral: boolean; // True for WithdrawCollateral, False for Withdraw
};

export type SubgraphBorrowTx = SubgraphBaseTx;

export type SubgraphRepayTx = SubgraphBaseTx;

export type SubgraphLiquidationTx = {
  id: string;
  hash: string;
  timestamp: string;
  market: SubgraphMarketReference;
  liquidator: SubgraphAccountReference; // The account calling liquidate
  amount: string; // Collateral seized amount (string)
  repaid: string; // Debt repaid amount (string)
};

// Structure based on the example query { account(id: ...) { ... } }
export type SubgraphAccountData = {
  deposits: SubgraphDepositTx[];
  withdraws: SubgraphWithdrawTx[];
  borrows: SubgraphBorrowTx[];
  repays: SubgraphRepayTx[];
  liquidations: SubgraphLiquidationTx[]; // Assuming liquidations where user was liquidated
};

// The full response structure from the subgraph query
export type SubgraphTransactionResponse = {
  data: {
    account: SubgraphAccountData | null;
  };
  errors?: { message: string }[];
};
