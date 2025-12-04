'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAllMorphoVaults } from '@/hooks/useAllMorphoVaults';
import type { MorphoVault } from '@/data-sources/morpho-api/vaults';
import type { Address } from 'viem';

type VaultRegistryContextType = {
  vaults: MorphoVault[];
  loading: boolean;
  error: Error | null;
  getVaultByAddress: (address: Address, chainId?: number) => MorphoVault | undefined;
};

const VaultRegistryContext = createContext<VaultRegistryContextType | undefined>(undefined);

export function VaultRegistryProvider({ children }: { children: ReactNode }) {
  const { vaults, loading, error } = useAllMorphoVaults();

  const getVaultByAddress = useMemo(
    () => (address: Address, chainId?: number) => {
      const normalizedAddress = address.toLowerCase();
      return vaults.find(
        (v) =>
          v.address.toLowerCase() === normalizedAddress && (!chainId || v.chainId === chainId),
      );
    },
    [vaults],
  );

  const value = useMemo(
    () => ({
      vaults,
      loading,
      error,
      getVaultByAddress,
    }),
    [vaults, loading, error, getVaultByAddress],
  );

  return <VaultRegistryContext.Provider value={value}>{children}</VaultRegistryContext.Provider>;
}

export function useVaultRegistry() {
  const context = useContext(VaultRegistryContext);
  if (context === undefined) {
    throw new Error('useVaultRegistry must be used within a VaultRegistryProvider');
  }
  return context;
}
