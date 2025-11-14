'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';

function ToasterProvider() {
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  return (
    <Toaster
      position="bottom-right"
      theme={(theme as 'light' | 'dark' | 'system' | undefined) ?? 'system'}
      toastOptions={{
        style: {
          background: isDark ? '#202426' : '#fff',
          color: isDark ? '#fff' : '#000',
          border: 'none',
          borderRadius: '3px',
          fontSize: '16px',
        },
        className: 'font-zen',
      }}
    />
  );
}

export function ThemeProviders({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={['light', 'dark']}
    >
      <HeroUIProvider>{children}</HeroUIProvider>
      <ToasterProvider />
    </NextThemesProvider>
  );
}
