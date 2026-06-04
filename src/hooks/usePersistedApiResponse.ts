import { useCallback, useEffect, useState } from 'react';
import { readPersistedApiResponse, writePersistedApiResponse, type CachedApiResponse } from '@/utils/persistedApiResponseCache';

type PersistedApiResponseState<T> = {
  entry: CachedApiResponse<T> | null;
  isReady: boolean;
};

export function usePersistedApiResponse<T>(key: string) {
  const [state, setState] = useState<PersistedApiResponseState<T>>({
    entry: null,
    isReady: false,
  });

  useEffect(() => {
    let shouldApplyCache = true;

    setState({ entry: null, isReady: false });
    void readPersistedApiResponse<T>(key).then((entry) => {
      if (shouldApplyCache) {
        setState({ entry, isReady: true });
      }
    });

    return () => {
      shouldApplyCache = false;
    };
  }, [key]);

  const write = useCallback(
    (entry: CachedApiResponse<T>) => {
      setState({ entry, isReady: true });
      void writePersistedApiResponse(key, entry);
    },
    [key],
  );

  return {
    ...state,
    write,
  };
}
