'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Address } from 'viem';
import type { SupportedNetworks } from '@/utils/networks';

type VaultIdContextValue = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
};

const VaultIdContext = createContext<VaultIdContextValue | null>(null);

export function VaultIdProvider({
  value,
  children,
}: {
  value: VaultIdContextValue;
  children: ReactNode;
}) {
  return <VaultIdContext.Provider value={value}>{children}</VaultIdContext.Provider>;
}

export function useVaultId(): VaultIdContextValue {
  const context = useContext(VaultIdContext);
  if (!context) {
    throw new Error('useVaultId must be used within VaultIdProvider');
  }
  return context;
}
