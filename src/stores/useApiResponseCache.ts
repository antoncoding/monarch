import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OracleMetadataFile } from '@/hooks/useOracleMetadata';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import { clearPersistedApiResponses, type CachedApiResponse } from '@/utils/persistedApiResponseCache';
import type { Market } from '@/utils/types';

type ApiResponseCacheState = {
  marketDetailsByKey: Record<string, CachedApiResponse<Market>>;
  oracleMetadataByKey: Record<string, CachedApiResponse<OracleMetadataFile>>;
};

type ApiResponseCacheActions = {
  clearCache: () => void;
  setMarketDetail: (key: string, data: Market) => void;
  setOracleMetadata: (key: string, data: OracleMetadataFile) => void;
};

type ApiResponseCacheStore = ApiResponseCacheState & ApiResponseCacheActions;

const MAX_MARKET_DETAILS_CACHE_ENTRIES = 100;
const MAX_ORACLE_METADATA_CACHE_ENTRIES = ALL_SUPPORTED_NETWORKS.length;

const DEFAULT_STATE: ApiResponseCacheState = {
  marketDetailsByKey: {},
  oracleMetadataByKey: {},
};

const trimCacheEntries = <T>(entries: Record<string, CachedApiResponse<T>>, maxEntries: number): Record<string, CachedApiResponse<T>> => {
  const sortedEntries = Object.entries(entries).sort(([, left], [, right]) => right.updatedAt - left.updatedAt);

  return Object.fromEntries(sortedEntries.slice(0, maxEntries));
};

const sanitizeOracleMetadataCache = (
  entries: Partial<Record<string, CachedApiResponse<OracleMetadataFile | null>>> = {},
): Record<string, CachedApiResponse<OracleMetadataFile>> => {
  return Object.fromEntries(
    Object.entries(entries).filter((entry): entry is [string, CachedApiResponse<OracleMetadataFile>] => {
      const [, cachedResponse] = entry;
      return Array.isArray(cachedResponse?.data?.oracles) && cachedResponse.data.oracles.length > 0;
    }),
  );
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
      setOracleMetadata: (key, data) =>
        set((state) => ({
          oracleMetadataByKey: trimCacheEntries(
            {
              ...state.oracleMetadataByKey,
              [key]: { data, updatedAt: Date.now() },
            },
            MAX_ORACLE_METADATA_CACHE_ENTRIES,
          ),
        })),
    }),
    {
      name: 'monarch_store_apiResponseCache',
      version: 4,
      partialize: (state) => ({
        marketDetailsByKey: state.marketDetailsByKey,
        oracleMetadataByKey: state.oracleMetadataByKey,
      }),
      migrate: (state) => {
        if (!state || typeof state !== 'object') {
          return DEFAULT_STATE;
        }

        const persistedState = state as Partial<ApiResponseCacheState>;

        return {
          marketDetailsByKey: persistedState.marketDetailsByKey ?? DEFAULT_STATE.marketDetailsByKey,
          oracleMetadataByKey: sanitizeOracleMetadataCache(persistedState.oracleMetadataByKey),
        };
      },
    },
  ),
);
