'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAppKitTheme } from '@reown/appkit/react';

/**
 * Syncs AppKit theme with next-themes
 */
export function AppKitThemeSync() {
  const { theme } = useTheme();
  const { setThemeMode } = useAppKitTheme();

  useEffect(() => {
    if (theme === 'dark' || theme === 'light') {
      setThemeMode(theme);
    }
  }, [theme, setThemeMode]);

  return null;
}
