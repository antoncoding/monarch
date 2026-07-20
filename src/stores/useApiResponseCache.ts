import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearPersistedApiResponses, type CachedApiResponse } from '@/utils/persistedApiResponseCache';
import type { Market } from '@/utils/types';

type ApiResponseCacheState = {
  marketDetailsByKey: Record<string, CachedApiResponse<Market>>;
};

type ApiResponseCacheActions = {
  clearCache: () => void;
  setMarketDetail: (key: string, data: Market) => void;
};

type ApiResponseCacheStore = ApiResponseCacheState & ApiResponseCacheActions;

const MAX_MARKET_DETAILS_CACHE_ENTRIES = 100;

const DEFAULT_STATE: ApiResponseCacheState = {
  marketDetailsByKey: {},
};

const trimCacheEntries = <T>(entries: Record<string, CachedApiResponse<T>>, maxEntries: number): Record<string, CachedApiResponse<T>> => {
  const sortedEntries = Object.entries(entries).sort(([, left], [, right]) => right.updatedAt - left.updatedAt);

  return Object.fromEntries(sortedEntries.slice(0, maxEntries));
};

export const useApiResponseCache = create<ApiResponseCacheStore>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      clearCache: () => {
        set(DEFAULT_STATE);
        void clearPersistedApiResponses();
      },
      setMarketDetail: (key, data) =>
        set((state) => ({
          marketDetailsByKey: trimCacheEntries(
            {
              ...state.marketDetailsByKey,
              [key]: { data, updatedAt: Date.now() },
            },
            MAX_MARKET_DETAILS_CACHE_ENTRIES,
          ),
        })),
    }),
    {
      name: 'monarch_store_apiResponseCache',
      version: 5,
      partialize: (state) => ({
        marketDetailsByKey: state.marketDetailsByKey,
      }),
      migrate: (state) => {
        if (!state || typeof state !== 'object') {
          return DEFAULT_STATE;
        }

        const persistedState = state as Partial<ApiResponseCacheState>;

        return {
          marketDetailsByKey: persistedState.marketDetailsByKey ?? DEFAULT_STATE.marketDetailsByKey,
        };
      },
    },
  ),
);
