'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ThemedToastContainer } from '@/components/ui/themed-toast-container';
import { TooltipProvider } from '@/components/ui/tooltip';

export function ThemeProviders({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={['light', 'dark']}
    >
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      <ThemedToastContainer />
    </NextThemesProvider>
  );
}
