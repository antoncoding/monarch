export type BorrowerTableColumnVisibility = {
  healthScore: boolean;
  daysToLiquidation: boolean;
  liquidationPrice: boolean;
};

export const BORROWER_TABLE_COLUMN_LABELS: Record<keyof BorrowerTableColumnVisibility, string> = {
  healthScore: 'Health Score',
  daysToLiquidation: 'Days to Liquidation',
  liquidationPrice: 'Liquidation Price',
};

export const BORROWER_TABLE_COLUMN_DESCRIPTIONS: Record<keyof BorrowerTableColumnVisibility, string> = {
  healthScore: 'Distance to liquidation threshold. 1.00 is the liquidation boundary.',
  daysToLiquidation: 'Estimated days until position reaches liquidation threshold.',
  liquidationPrice: 'Price where position becomes liquidatable, plus move from current oracle price.',
};

export const DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY: BorrowerTableColumnVisibility = {
  healthScore: true,
  daysToLiquidation: true,
  liquidationPrice: true,
};
