'use client';

import { NextUIProvider } from '@nextui-org/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ToastContainer } from 'react-toastify';

export function ThemeProviders({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={['light', 'dark']}
    >
      <NextUIProvider>{children}</NextUIProvider>
      <ToastContainer
        position="bottom-right"
        toastClassName="bg-[#fff] dark:bg-[#202426] text-[#000] dark:text-[#fff]"
        toastStyle={{ borderRadius: '3px', fontSize: '16px' }}
      />
    </NextThemesProvider>
  );
}
