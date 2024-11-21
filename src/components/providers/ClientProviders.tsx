'use client';

import { ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import { MarketsProvider } from '@/contexts/MarketsContext';

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
