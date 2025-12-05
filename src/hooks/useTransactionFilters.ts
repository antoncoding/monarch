import { useLocalStorage } from './useLocalStorage';

type SymbolFilters = {
  [symbol: string]: {
    minSupplyAmount: string;
    minBorrowAmount: string;
  };
};

/**
 * Hook to manage transaction filter settings with localStorage persistence
 * Filters are cached per token symbol (e.g., all USDC markets share the same filter)
 */
export function useTransactionFilters(loanAssetSymbol: string) {
  const [allFilters, setAllFilters] = useLocalStorage<SymbolFilters>('monarch_transaction_filters_v2', {});

  const currentFilters = allFilters[loanAssetSymbol] ?? {
    minSupplyAmount: '0',
    minBorrowAmount: '0',
  };

  const setMinSupplyAmount = (value: string) => {
    setAllFilters((prev) => ({
      ...prev,
      [loanAssetSymbol]: {
        ...prev[loanAssetSymbol],
        minSupplyAmount: value,
        minBorrowAmount: prev[loanAssetSymbol]?.minBorrowAmount ?? '0',
      },
    }));
  };

  const setMinBorrowAmount = (value: string) => {
    setAllFilters((prev) => ({
      ...prev,
      [loanAssetSymbol]: {
        ...prev[loanAssetSymbol],
        minSupplyAmount: prev[loanAssetSymbol]?.minSupplyAmount ?? '0',
        minBorrowAmount: value,
      },
    }));
  };

  return {
    minSupplyAmount: currentFilters.minSupplyAmount,
    minBorrowAmount: currentFilters.minBorrowAmount,
    setMinSupplyAmount,
    setMinBorrowAmount,
  };
}
