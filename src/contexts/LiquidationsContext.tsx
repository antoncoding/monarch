'use client';

import { createContext, useContext, type ReactNode, useMemo } from 'react';
import useLiquidations from '@/hooks/useLiquidations';

type LiquidationsContextType = {
  isProtectedByLiquidationBots: (marketId: string) => boolean;
  loading: boolean;
  error: unknown | null;
  refetch: () => Promise<void>;
};

const LiquidationsContext = createContext<LiquidationsContextType | undefined>(undefined);

type LiquidationsProviderProps = {
  children: ReactNode;
};

export function LiquidationsProvider({ children }: LiquidationsProviderProps) {
  const { liquidatedMarketKeys, loading, error, refetch } = useLiquidations();

  const value = useMemo(
    () => ({
      isProtectedByLiquidationBots: (marketId: string) => liquidatedMarketKeys.has(marketId),
      loading,
      error,
      refetch,
    }),
    [liquidatedMarketKeys, loading, error, refetch],
  );

  return <LiquidationsContext.Provider value={value}>{children}</LiquidationsContext.Provider>;
}

export function useLiquidationsContext() {
  const context = useContext(LiquidationsContext);
  if (context === undefined) {
    throw new Error('useLiquidationsContext must be used within a LiquidationsProvider');
  }
  return context;
}
