export type BorrowedTableColumnVisibility = {
  healthScore: boolean;
};

export const BORROWED_TABLE_COLUMN_LABELS: Record<keyof BorrowedTableColumnVisibility, string> = {
  healthScore: 'Health Score',
};

export const BORROWED_TABLE_COLUMN_DESCRIPTIONS: Record<keyof BorrowedTableColumnVisibility, string> = {
  healthScore: 'Distance to liquidation threshold. 1.00 is the liquidation boundary.',
};

export const DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY: BorrowedTableColumnVisibility = {
  healthScore: true,
};
