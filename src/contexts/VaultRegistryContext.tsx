'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { MorphoVault } from '@/data-sources/morpho-api/vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useVaultAdapterAliasesQuery } from '@/hooks/queries/useVaultAdapterAliasesQuery';
import type { Address } from 'viem';

type AddressLabel = {
  displayName: string;
  kind: 'vault' | 'vault-adapter';
  vaultAddress: string;
  adapterType?: string;
};

type AdapterAddressAlias = {
  adapterType: string;
  vaultAddress: string;
  vaultName: string;
};

type VaultRegistryContextType = {
  vaults: MorphoVault[];
  loading: boolean;
  error: Error | null;
  getVaultByAddress: (address: Address, chainId?: number) => MorphoVault | undefined;
  getAddressLabel: (address: Address, chainId?: number) => AddressLabel | undefined;
};

const VaultRegistryContext = createContext<VaultRegistryContextType | undefined>(undefined);

const getAddressKey = (address: string, chainId: number) => `${chainId}:${address.toLowerCase()}`;

export function VaultRegistryProvider({ children }: { children: ReactNode }) {
  const { data: vaults = [], isLoading: vaultsLoading, error: vaultsError } = useAllMorphoVaultsQuery();
  const { data: adapterAliases = [], isLoading: adapterAliasesLoading, error: adapterAliasesError } = useVaultAdapterAliasesQuery();

  const vaultsByScopedAddress = useMemo(() => {
    const lookup = new Map<string, MorphoVault>();
    for (const vault of vaults) {
      lookup.set(getAddressKey(vault.address, vault.chainId), vault);
    }
    return lookup;
  }, [vaults]);

  const adapterAliasesByScopedAddress = useMemo(() => {
    const lookup = new Map<string, AdapterAddressAlias>();
    for (const adapterAlias of adapterAliases) {
      lookup.set(getAddressKey(adapterAlias.address, adapterAlias.chainId), {
        vaultAddress: adapterAlias.vaultAddress,
        vaultName: adapterAlias.vaultName,
        adapterType: adapterAlias.adapterType,
      });
    }
    return lookup;
  }, [adapterAliases]);

  const getVaultByAddress = useCallback(
    (address: Address, chainId?: number) => {
      const normalizedAddress = address.toLowerCase();
      if (chainId) {
        return vaultsByScopedAddress.get(getAddressKey(normalizedAddress, chainId));
      }

      return vaults.find((vault) => vault.address.toLowerCase() === normalizedAddress);
    },
    [vaults, vaultsByScopedAddress],
  );

  const getAddressLabel = useCallback(
    (address: Address, chainId?: number): AddressLabel | undefined => {
      const vault = getVaultByAddress(address, chainId);
      if (vault?.name) {
        return {
          displayName: vault.name,
          kind: 'vault',
          vaultAddress: vault.address.toLowerCase(),
        };
      }

      if (!chainId) {
        return undefined;
      }

      const adapterAlias = adapterAliasesByScopedAddress.get(getAddressKey(address, chainId));
      if (!adapterAlias) {
        return undefined;
      }

      return {
        displayName: `${adapterAlias.vaultName} (adapter)`,
        kind: 'vault-adapter',
        vaultAddress: adapterAlias.vaultAddress,
        adapterType: adapterAlias.adapterType,
      };
    },
    [adapterAliasesByScopedAddress, getVaultByAddress],
  );

  const value = useMemo(
    () => ({
      vaults,
      loading: vaultsLoading || adapterAliasesLoading,
      error: vaultsError ?? adapterAliasesError,
      getVaultByAddress,
      getAddressLabel,
    }),
    [vaults, vaultsLoading, adapterAliasesLoading, vaultsError, adapterAliasesError, getVaultByAddress, getAddressLabel],
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
