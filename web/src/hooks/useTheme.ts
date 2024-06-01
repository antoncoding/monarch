import { useEffect, useState } from 'react';
import storage from 'local-storage-fallback';
import * as storageKeys from '@/utils/storageKeys';

export const useTheme = () => {
  const [theme, setTheme] = useState('dark'); // default theme

  // Function to toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    storage.setItem(storageKeys.ThemeKey, newTheme);
    setTheme(newTheme);
  };

  useEffect(() => {
    // Check local storage and then system preference
    const localTheme = storage.getItem(storageKeys.ThemeKey);
    if (localTheme) {
      setTheme(localTheme);
      if (localTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      setTheme(systemPreference);
      if (systemPreference === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  return { theme, toggleTheme };
};
