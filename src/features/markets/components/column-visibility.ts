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
};

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  totalSupply: true,
  totalBorrow: true,
  liquidity: false,
  supplyAPY: true,
  borrowAPY: false,
  rateAtTarget: false,
  trustedBy: false,
  utilizationRate: false,
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
};
