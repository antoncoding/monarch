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

const runStoreRequest = async <T, TResult>(
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<TResult>,
  getSuccessValue: (request: IDBRequest<TResult>) => T,
  fallbackValue: T,
): Promise<T> => {
  const database = await openDatabase();
  if (!database) {
    return fallbackValue;
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: T) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    const transaction = database.transaction(STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => settle(getSuccessValue(request));
    request.onerror = () => settle(fallbackValue);
    transaction.onerror = () => settle(fallbackValue);
    transaction.onabort = () => settle(fallbackValue);
  });
};

export const readPersistedApiResponse = async <T>(key: string): Promise<CachedApiResponse<T> | null> =>
  runStoreRequest<CachedApiResponse<T> | null, PersistedResponseRecord<T> | undefined>(
    'readonly',
    (store) => store.get(key) as IDBRequest<PersistedResponseRecord<T> | undefined>,
    (request) => {
      return request.result ? { data: request.result.data, updatedAt: request.result.updatedAt } : null;
    },
    null,
  );

export const writePersistedApiResponse = async <T>(key: string, response: CachedApiResponse<T>): Promise<boolean> =>
  runStoreRequest<boolean, IDBValidKey>(
    'readwrite',
    (store) => store.put({ ...response, key }),
    () => true,
    false,
  );

export const clearPersistedApiResponses = async (): Promise<boolean> =>
  runStoreRequest<boolean, undefined>(
    'readwrite',
    (store) => store.clear(),
    () => true,
    false,
  );
