export type CachedApiResponse<T> = {
  data: T;
  updatedAt: number;
};

const DATABASE_NAME = 'monarch_api_response_cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'responses';
let databasePromise: Promise<IDBDatabase | null> | null = null;

type PersistedResponseRecord<T> = CachedApiResponse<T> & {
  key: string;
};

const getIndexedDb = (): IDBFactory | null => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  return window.indexedDB;
};

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (databasePromise) {
    return databasePromise;
  }

  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    return Promise.resolve(null);
  }

  databasePromise = new Promise((resolve) => {
    let settled = false;
    const settle = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close();
        return;
      }

      settled = true;
      resolve(database);
    };
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      settle(database);
    };
    request.onerror = () => {
      databasePromise = null;
      settle(null);
    };
    request.onblocked = () => {
      databasePromise = null;
      settle(null);
    };
  });

  return databasePromise;
};

export const createPersistedApiResponseKey = (namespace: string, parts: unknown[]): string => {
  const serialized = JSON.stringify(parts, (_, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${namespace}:${(hash >>> 0).toString(36)}`;
};

const runStoreTransaction = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => T, fallbackValue: T): Promise<T> => {
  try {
    const database = await openDatabase();
    if (!database) {
      return fallbackValue;
    }

    return await new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, mode);
      transaction.onabort = () => resolve(fallbackValue);
      try {
        const result = run(transaction.objectStore(STORE_NAME));
        transaction.oncomplete = () => resolve(result);
      } catch {
        transaction.abort();
      }
    });
  } catch {
    // Browser storage is optional; unavailable storage must not block live queries.
    return fallbackValue;
  }
};

export const readPersistedApiResponses = async <T>(keys: readonly string[]): Promise<Map<string, CachedApiResponse<T>>> =>
  runStoreTransaction(
    'readonly',
    (store) => {
      const entries = new Map<string, CachedApiResponse<T>>();
      for (const key of keys) {
        const request: IDBRequest<PersistedResponseRecord<T> | undefined> = store.get(key);
        request.onsuccess = () => {
          if (request.result) {
            const { data, updatedAt } = request.result;
            entries.set(key, { data, updatedAt });
          }
        };
      }
      return entries;
    },
    new Map(),
  );

export const readPersistedApiResponse = async <T>(key: string): Promise<CachedApiResponse<T> | null> =>
  (await readPersistedApiResponses<T>([key])).get(key) ?? null;

export const writePersistedApiResponses = async <T>(entries: Iterable<readonly [string, CachedApiResponse<T>]>): Promise<boolean> =>
  runStoreTransaction(
    'readwrite',
    (store) => {
      for (const [key, response] of entries) {
        store.put({ ...response, key });
      }
      return true;
    },
    false,
  );

export const writePersistedApiResponse = async <T>(key: string, response: CachedApiResponse<T>): Promise<boolean> =>
  writePersistedApiResponses([[key, response]]);

export const clearPersistedApiResponses = async (): Promise<boolean> =>
  runStoreTransaction(
    'readwrite',
    (store) => {
      store.clear();
      return true;
    },
    false,
  );
