export type BorrowerTableColumnVisibility = {
  daysToLiquidation: boolean;
  liquidationPrice: boolean;
};

export const BORROWER_TABLE_COLUMN_LABELS: Record<keyof BorrowerTableColumnVisibility, string> = {
  daysToLiquidation: 'Days to Liquidation',
  liquidationPrice: 'Liquidation Price',
};

export const BORROWER_TABLE_COLUMN_DESCRIPTIONS: Record<keyof BorrowerTableColumnVisibility, string> = {
  daysToLiquidation: 'Estimated days until position reaches liquidation threshold.',
  liquidationPrice: 'Price where position becomes liquidatable, plus move from current oracle price.',
};

export const DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY: BorrowerTableColumnVisibility = {
  daysToLiquidation: true,
  liquidationPrice: true,
};
