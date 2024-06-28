'use client';

import { NextUIProvider } from '@nextui-org/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider disableTransitionOnChange attribute="class">
      <NextUIProvider>{children}</NextUIProvider>
    </NextThemesProvider>
  );
}
