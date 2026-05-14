'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { MorphoVault } from '@/data-sources/morpho-api/vaults';
import type { VaultAdapterAlias } from '@/data-sources/monarch-api/vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useVaultAdapterAliasesQuery } from '@/hooks/queries/useVaultAdapterAliasesQuery';
import type { Address } from 'viem';

export type VaultAccountKind = 'morpho-vault' | 'vault-v2' | 'vault-adapter';

export type VaultAccountIdentity = {
  kind: VaultAccountKind;
  displayName: string;
  chainId: number;
  address: Address;
  vaultAddress: Address;
  adapterAddress?: Address;
  adapterType?: string;
  assetAddress?: Address;
  assetSymbol?: string;
  metadataDescription?: string;
  metadataImage?: string;
  source: 'morpho' | 'monarch';
};

type AddressLabel = {
  displayName: string;
  kind: VaultAccountKind;
  chainId: number;
  vaultAddress: Address;
  adapterAddress?: Address;
  adapterType?: string;
};

type AdapterAddressAlias = {
  adapterAddress: string;
  adapterType: string;
  chainId: number;
  vaultAddress: string;
  vaultName: string;
};

type VaultRegistryContextType = {
  vaults: MorphoVault[];
  loading: boolean;
  error: Error | null;
  getVaultByAddress: (address: Address, chainId?: number) => MorphoVault | undefined;
  getVaultAccountIdentity: (address: Address, chainId?: number) => VaultAccountIdentity | undefined;
  getAddressLabel: (address: Address, chainId?: number) => AddressLabel | undefined;
};

const VaultRegistryContext = createContext<VaultRegistryContextType | undefined>(undefined);

const getAddressKey = (address: string, chainId: number) => `${chainId}:${address.toLowerCase()}`;

const toAddress = (value: string): Address => value.toLowerCase() as Address;

const getSingleAlias = (aliases?: AdapterAddressAlias[]) => (aliases?.length === 1 ? aliases[0] : undefined);

const toAdapterAddressAlias = (adapterAlias: VaultAdapterAlias): AdapterAddressAlias => ({
  adapterAddress: adapterAlias.address,
  adapterType: adapterAlias.adapterType,
  chainId: adapterAlias.chainId,
  vaultAddress: adapterAlias.vaultAddress,
  vaultName: adapterAlias.vaultName,
});

const morphoVaultToIdentity = (vault: MorphoVault): VaultAccountIdentity => ({
  kind: 'morpho-vault',
  displayName: vault.name,
  chainId: vault.chainId,
  address: toAddress(vault.address),
  vaultAddress: toAddress(vault.address),
  assetAddress: toAddress(vault.assetAddress),
  assetSymbol: vault.assetSymbol,
  metadataDescription: vault.metadataDescription,
  metadataImage: vault.metadataImage,
  source: 'morpho',
});

const adapterAliasToAdapterIdentity = (adapterAlias: AdapterAddressAlias, morphoVault?: MorphoVault): VaultAccountIdentity => ({
  kind: 'vault-adapter',
  displayName: adapterAlias.vaultName,
  chainId: adapterAlias.chainId,
  address: toAddress(adapterAlias.adapterAddress),
  vaultAddress: toAddress(adapterAlias.vaultAddress),
  adapterAddress: toAddress(adapterAlias.adapterAddress),
  adapterType: adapterAlias.adapterType,
  assetAddress: morphoVault?.assetAddress ? toAddress(morphoVault.assetAddress) : undefined,
  assetSymbol: morphoVault?.assetSymbol,
  metadataDescription: morphoVault?.metadataDescription,
  metadataImage: morphoVault?.metadataImage,
  source: 'monarch',
});

const adapterAliasToVaultIdentity = (adapterAlias: AdapterAddressAlias, morphoVault?: MorphoVault): VaultAccountIdentity => ({
  kind: 'vault-v2',
  displayName: morphoVault?.name || adapterAlias.vaultName,
  chainId: adapterAlias.chainId,
  address: toAddress(adapterAlias.vaultAddress),
  vaultAddress: toAddress(adapterAlias.vaultAddress),
  adapterAddress: toAddress(adapterAlias.adapterAddress),
  adapterType: adapterAlias.adapterType,
  assetAddress: morphoVault?.assetAddress ? toAddress(morphoVault.assetAddress) : undefined,
  assetSymbol: morphoVault?.assetSymbol,
  metadataDescription: morphoVault?.metadataDescription,
  metadataImage: morphoVault?.metadataImage,
  source: 'monarch',
});

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
      lookup.set(getAddressKey(adapterAlias.address, adapterAlias.chainId), toAdapterAddressAlias(adapterAlias));
    }
    return lookup;
  }, [adapterAliases]);

  const adapterAliasesByAddress = useMemo(() => {
    const lookup = new Map<string, AdapterAddressAlias[]>();
    for (const adapterAlias of adapterAliases) {
      const key = adapterAlias.address.toLowerCase();
      lookup.set(key, [...(lookup.get(key) ?? []), toAdapterAddressAlias(adapterAlias)]);
    }
    return lookup;
  }, [adapterAliases]);

  const adapterAliasesByVaultAddress = useMemo(() => {
    const lookup = new Map<string, AdapterAddressAlias[]>();
    for (const adapterAlias of adapterAliases) {
      const key = adapterAlias.vaultAddress.toLowerCase();
      lookup.set(key, [...(lookup.get(key) ?? []), toAdapterAddressAlias(adapterAlias)]);
    }
    return lookup;
  }, [adapterAliases]);

  const adapterAliasesByVaultScopedAddress = useMemo(() => {
    const lookup = new Map<string, AdapterAddressAlias[]>();
    for (const adapterAlias of adapterAliases) {
      const key = getAddressKey(adapterAlias.vaultAddress, adapterAlias.chainId);
      const existing = lookup.get(key) ?? [];
      existing.push(toAdapterAddressAlias(adapterAlias));
      lookup.set(key, existing);
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

  const getVaultAccountIdentity = useCallback(
    (address: Address, chainId?: number): VaultAccountIdentity | undefined => {
      const normalizedAddress = address.toLowerCase();

      const adapterAlias = chainId
        ? adapterAliasesByScopedAddress.get(getAddressKey(normalizedAddress, chainId))
        : getSingleAlias(adapterAliasesByAddress.get(normalizedAddress));

      if (adapterAlias) {
        return adapterAliasToAdapterIdentity(adapterAlias, getVaultByAddress(toAddress(adapterAlias.vaultAddress), adapterAlias.chainId));
      }

      const vaultAlias = chainId
        ? adapterAliasesByVaultScopedAddress.get(getAddressKey(normalizedAddress, chainId))?.[0]
        : getSingleAlias(adapterAliasesByVaultAddress.get(normalizedAddress));
      if (vaultAlias) {
        return adapterAliasToVaultIdentity(vaultAlias, getVaultByAddress(address, vaultAlias.chainId));
      }

      const vault = getVaultByAddress(address, chainId);
      if (vault) {
        return morphoVaultToIdentity(vault);
      }

      return undefined;
    },
    [
      adapterAliasesByAddress,
      adapterAliasesByScopedAddress,
      adapterAliasesByVaultAddress,
      adapterAliasesByVaultScopedAddress,
      getVaultByAddress,
    ],
  );

  const getAddressLabel = useCallback(
    (address: Address, chainId?: number): AddressLabel | undefined => {
      const identity = getVaultAccountIdentity(address, chainId);
      if (!identity) {
        return undefined;
      }

      return {
        displayName: identity.kind === 'vault-adapter' ? `${identity.displayName} (adapter)` : identity.displayName,
        kind: identity.kind,
        chainId: identity.chainId,
        vaultAddress: identity.vaultAddress,
        adapterAddress: identity.adapterAddress,
        adapterType: identity.adapterType,
      };
    },
    [getVaultAccountIdentity],
  );

  const value = useMemo(
    () => ({
      vaults,
      loading: vaultsLoading || adapterAliasesLoading,
      error: vaultsError ?? adapterAliasesError,
      getVaultByAddress,
      getVaultAccountIdentity,
      getAddressLabel,
    }),
    [
      vaults,
      vaultsLoading,
      adapterAliasesLoading,
      vaultsError,
      adapterAliasesError,
      getVaultByAddress,
      getVaultAccountIdentity,
      getAddressLabel,
    ],
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
