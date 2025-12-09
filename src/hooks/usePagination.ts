import { useState, useEffect, useCallback } from 'react';
import storage from 'local-storage-fallback';
import { storageKeys } from '@/utils/storageKeys';

export function usePagination(initialEntriesPerPage = 6) {
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(initialEntriesPerPage);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  useEffect(() => {
    const storedEntriesPerPage = storage.getItem(storageKeys.MarketEntriesPerPageKey);
    if (storedEntriesPerPage) {
      setEntriesPerPage(Number.parseInt(storedEntriesPerPage, 10));
    }
  }, []);

  const handleEntriesPerPageChange = (value: number) => {
    setEntriesPerPage(value);
    storage.setItem(storageKeys.MarketEntriesPerPageKey, value.toString());
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
