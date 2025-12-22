import { formatReadable } from '@/utils/balance';

type SuppliedAmountCellProps = {
  amount: number;
  symbol: string;
};

/**
 * Shared component for displaying supplied amount in expanded tables.
 * Used by both Morpho Blue and Vault allocation details.
 */
export function SuppliedAmountCell({ amount, symbol }: SuppliedAmountCellProps) {
  return (
    <>
      {formatReadable(amount)} {symbol}
    </>
  );
}
