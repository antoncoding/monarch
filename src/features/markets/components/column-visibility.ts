// Column visibility configuration for markets table

export type ColumnVisibility = {
  totalSupply: boolean;
  totalBorrow: boolean;
  liquidity: boolean;
  supplyAPY: boolean;
  borrowAPY: boolean;
  rateAtTarget: boolean;
  trustedBy: boolean;
  utilizationRate: boolean;
  dailySupplyAPY: boolean;
  dailyBorrowAPY: boolean;
  weeklySupplyAPY: boolean;
  weeklyBorrowAPY: boolean;
  monthlySupplyAPY: boolean;
  monthlyBorrowAPY: boolean;
};

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  totalSupply: true,
  totalBorrow: true,
  liquidity: false,
  supplyAPY: true,
  borrowAPY: true,
  rateAtTarget: true,
  trustedBy: false,
  utilizationRate: false,
  dailySupplyAPY: false,
  dailyBorrowAPY: false,
  weeklySupplyAPY: false,
  weeklyBorrowAPY: false,
  monthlySupplyAPY: false,
  monthlyBorrowAPY: false,
};

export const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  totalSupply: 'Total Supply',
  totalBorrow: 'Total Borrow',
  liquidity: 'Liquidity',
  supplyAPY: 'Supply APY',
  borrowAPY: 'Borrow APY',
  rateAtTarget: 'Target Rate',
  trustedBy: 'Trusted By',
  utilizationRate: 'Utilization',
  dailySupplyAPY: '24h Supply APY',
  dailyBorrowAPY: '24h Borrow APY',
  weeklySupplyAPY: '7d Supply APY',
  weeklyBorrowAPY: '7d Borrow APY',
  monthlySupplyAPY: '30d Supply APY',
  monthlyBorrowAPY: '30d Borrow APY',
};

export const COLUMN_DESCRIPTIONS: Record<keyof ColumnVisibility, string> = {
  totalSupply: 'Total assets supplied to the market',
  totalBorrow: 'Total assets borrowed from the market',
  liquidity: 'Available liquidity (supply - borrow)',
  supplyAPY: 'Annual percentage yield for suppliers',
  borrowAPY: 'Annual percentage rate for borrowers',
  rateAtTarget: 'Interest rate at target utilization',
  trustedBy: 'Highlights your trusted vaults that currently supply this market',
  utilizationRate: 'Percentage of supplied assets currently borrowed',
  dailySupplyAPY: '24-hour average supply APY',
  dailyBorrowAPY: '24-hour average borrow APY',
  weeklySupplyAPY: '7-day average supply APY',
  weeklyBorrowAPY: '7-day average borrow APY',
  monthlySupplyAPY: '30-day average supply APY',
  monthlyBorrowAPY: '30-day average borrow APY',
};
