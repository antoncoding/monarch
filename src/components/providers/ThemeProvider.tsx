'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';

function ToasterProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={theme as 'light' | 'dark' | 'system'}
      toastOptions={{
        style: {
          background: 'var(--toast-bg)',
          color: 'var(--toast-color)',
          border: 'none',
          borderRadius: '3px',
          fontSize: '16px',
        },
        className: 'bg-[#fff] dark:bg-[#202426] text-[#000] dark:text-[#fff]',
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
