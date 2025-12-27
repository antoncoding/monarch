import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SymbolFilters = Record<
  string,
  {
    minSupplyAmount: string;
    minBorrowAmount: string;
  }
>;

type TransactionFiltersState = {
  filters: SymbolFilters;
};

type TransactionFiltersActions = {
  setMinSupplyAmount: (symbol: string, value: string) => void;
  setMinBorrowAmount: (symbol: string, value: string) => void;

  // Bulk update for migration
  setAll: (state: Partial<TransactionFiltersState>) => void;
};

type TransactionFiltersStore = TransactionFiltersState & TransactionFiltersActions;

/**
 * Zustand store for transaction filter settings with localStorage persistence.
 * Filters are cached per token symbol (e.g., all USDC markets share the same filter).
 */
export const useTransactionFiltersStore = create<TransactionFiltersStore>()(
  persist(
    (set) => ({
      // Default state
      filters: {},

      // Actions
      setMinSupplyAmount: (symbol, value) => {
        set((state) => ({
          filters: {
            ...state.filters,
            [symbol]: {
              ...state.filters[symbol],
              minSupplyAmount: value,
              minBorrowAmount: state.filters[symbol]?.minBorrowAmount ?? '0',
            },
          },
        }));
      },

      setMinBorrowAmount: (symbol, value) => {
        set((state) => ({
          filters: {
            ...state.filters,
            [symbol]: {
              ...state.filters[symbol],
              minSupplyAmount: state.filters[symbol]?.minSupplyAmount ?? '0',
              minBorrowAmount: value,
            },
          },
        }));
      },

      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_transactionFilters',
    },
  ),
);

/**
 * Convenience hook with scoped API for a specific token symbol.
 * Maintains backward-compatible interface with the old useLocalStorage-based hook.
 *
 * @example
 * ```tsx
 * const { minSupplyAmount, setMinSupplyAmount } = useTransactionFilters('USDC');
 * ```
 */
export function useTransactionFilters(loanAssetSymbol: string) {
  const currentFilters = useTransactionFiltersStore((s) => s.filters[loanAssetSymbol] ?? { minSupplyAmount: '0', minBorrowAmount: '0' });

  const setMinSupply = useTransactionFiltersStore((s) => s.setMinSupplyAmount);
  const setMinBorrow = useTransactionFiltersStore((s) => s.setMinBorrowAmount);

  return useMemo(
    () => ({
      minSupplyAmount: currentFilters.minSupplyAmount,
      minBorrowAmount: currentFilters.minBorrowAmount,
      setMinSupplyAmount: (value: string) => setMinSupply(loanAssetSymbol, value),
      setMinBorrowAmount: (value: string) => setMinBorrow(loanAssetSymbol, value),
    }),
    [currentFilters, setMinSupply, setMinBorrow, loanAssetSymbol],
  );
}
