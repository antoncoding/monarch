import { useState, useCallback } from 'react';
import storage from 'local-storage-fallback';
import { useStyledToast } from '@/hooks/useStyledToast';
import { storageKeys } from '@/utils/storageKeys';

const getInitialStaredMarkets = (): string[] => {
  try {
    const item = storage.getItem(storageKeys.MarketFavoritesKey) ?? '[]';
    return JSON.parse(item) as string[];
  } catch (error) {
    console.error('Error parsing stared markets from localStorage', error);
    return [];
  }
};

export const useStaredMarkets = () => {
  const [staredIds, setStaredIds] = useState<string[]>(getInitialStaredMarkets);
  const { success: toastSuccess } = useStyledToast();

  const starMarket = useCallback(
    (id: string) => {
      if (staredIds.includes(id)) return; // Already stared

      const newStaredIds = [...staredIds, id];
      setStaredIds(newStaredIds);
      storage.setItem(storageKeys.MarketFavoritesKey, JSON.stringify(newStaredIds));
      toastSuccess('Market starred', 'Market added to favorites');
    },
    [staredIds, toastSuccess],
  );

  const unstarMarket = useCallback(
    (id: string) => {
      if (!staredIds.includes(id)) return; // Not stared

      const newStaredIds = staredIds.filter((i) => i !== id);
      setStaredIds(newStaredIds);
      storage.setItem(storageKeys.MarketFavoritesKey, JSON.stringify(newStaredIds));
      toastSuccess('Market unstarred', 'Market removed from favorites');
    },
    [staredIds, toastSuccess],
  );

  return { staredIds, starMarket, unstarMarket };
};
