import { useState, useCallback } from 'react';
import { useMarketPreferences } from '@/stores/useMarketPreferences';

/**
 * Hook for managing pagination state.
 * - currentPage: Local state (not persisted)
 * - entriesPerPage: From Zustand store (persisted)
 */
export function usePagination() {
  const [currentPage, setCurrentPage] = useState(1);
  const { entriesPerPage, setEntriesPerPage } = useMarketPreferences();

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handleEntriesPerPageChange = (value: number) => {
    setEntriesPerPage(value);
    setCurrentPage(1); // Reset to first page
  };

  return {
    currentPage,
    setCurrentPage,
    entriesPerPage,
    resetPage,
    handleEntriesPerPageChange,
  };
}
