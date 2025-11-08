import { useCallback, useEffect, useState } from 'react';
import storage from 'local-storage-fallback';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): readonly [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  // Always use initialValue during SSR and before hydration
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Hydrate from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const item = storage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        // Save state
        setStoredValue(valueToStore);

        // Save to localStorage only on client
        if (typeof window !== 'undefined') {
          storage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue],
  );

  // Sync updates from other windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch (error) {
          console.warn(`Error parsing localStorage value for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue] as const;
}
