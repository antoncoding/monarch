'use client';

import { ReactNode } from 'react';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { ToastContainer } from 'react-toastify';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <MarketsProvider>
      {children}
      <ToastContainer position="bottom-right" bodyClassName="font-zen" />
    </MarketsProvider>
  );
} 