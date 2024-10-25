import { useState, useEffect, useCallback } from 'react';
import storage from 'local-storage-fallback';
import { MarketEntriesPerPageKey } from '@/utils/storageKeys';

export function usePagination(initialEntriesPerPage = 6) {
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(initialEntriesPerPage);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  useEffect(() => {
    const storedEntriesPerPage = storage.getItem(MarketEntriesPerPageKey);
    if (storedEntriesPerPage) {
      setEntriesPerPage(parseInt(storedEntriesPerPage, 10));
    }
  }, []);

  const handleEntriesPerPageChange = (value: number) => {
    setEntriesPerPage(value);
    storage.setItem(MarketEntriesPerPageKey, value.toString());
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
