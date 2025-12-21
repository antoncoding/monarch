'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ToastContainer } from 'react-toastify';
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
      <ToastContainer
        position="bottom-right"
        toastClassName="bg-[#fff] dark:bg-[#202426] text-[#000] dark:text-[#fff]"
        toastStyle={{ borderRadius: '3px', fontSize: '16px' }}
      />
    </NextThemesProvider>
  );
}
