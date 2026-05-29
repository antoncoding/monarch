'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { MorphoVault } from '@/data-sources/morpho-api/vaults';
import type { VaultAdapterRelation } from '@/data-sources/monarch-api/vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useVaultAdapterRelationsQuery } from '@/hooks/queries/useVaultAdapterRelationsQuery';
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

type AdapterVaultRelation = {
  adapterAddress: string;
  adapterType?: string;
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

const toAdapterVaultRelation = (relation: VaultAdapterRelation): AdapterVaultRelation => ({
  adapterAddress: relation.adapterAddress,
  adapterType: relation.adapterType,
  chainId: relation.chainId,
  vaultAddress: relation.vaultAddress,
  vaultName: relation.vaultName,
});

const toOptionalAdapterVaultRelation = (relation?: VaultAdapterRelation) => (relation ? toAdapterVaultRelation(relation) : undefined);

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

const adapterRelationToAdapterIdentity = (relation: AdapterVaultRelation, morphoVault?: MorphoVault): VaultAccountIdentity => ({
  kind: 'vault-adapter',
  displayName: relation.vaultName,
  chainId: relation.chainId,
  address: toAddress(relation.adapterAddress),
  vaultAddress: toAddress(relation.vaultAddress),
  adapterAddress: toAddress(relation.adapterAddress),
  adapterType: relation.adapterType,
  assetAddress: morphoVault?.assetAddress ? toAddress(morphoVault.assetAddress) : undefined,
  assetSymbol: morphoVault?.assetSymbol,
  metadataDescription: morphoVault?.metadataDescription,
  metadataImage: morphoVault?.metadataImage,
  source: 'monarch',
});

const adapterRelationToVaultIdentity = (relation: AdapterVaultRelation, morphoVault?: MorphoVault): VaultAccountIdentity => ({
  kind: 'vault-v2',
  displayName: morphoVault?.name || relation.vaultName,
  chainId: relation.chainId,
  address: toAddress(relation.vaultAddress),
  vaultAddress: toAddress(relation.vaultAddress),
  adapterAddress: toAddress(relation.adapterAddress),
  adapterType: relation.adapterType,
  assetAddress: morphoVault?.assetAddress ? toAddress(morphoVault.assetAddress) : undefined,
  assetSymbol: morphoVault?.assetSymbol,
  metadataDescription: morphoVault?.metadataDescription,
  metadataImage: morphoVault?.metadataImage,
  source: 'monarch',
});

export function VaultRegistryProvider({ children }: { children: ReactNode }) {
  const { data: vaults = [], isLoading: vaultsLoading, error: vaultsError } = useAllMorphoVaultsQuery();
  const { data: adapterRelations = [], isLoading: adapterRelationsLoading, error: adapterRelationsError } = useVaultAdapterRelationsQuery();

  const vaultsByScopedAddress = useMemo(() => {
    const lookup = new Map<string, MorphoVault>();
    for (const vault of vaults) {
      lookup.set(getAddressKey(vault.address, vault.chainId), vault);
    }
    return lookup;
  }, [vaults]);

  const adapterRelationsByScopedAddress = useMemo(() => {
    const lookup = new Map<string, AdapterVaultRelation>();
    for (const relation of adapterRelations) {
      lookup.set(getAddressKey(relation.adapterAddress, relation.chainId), toAdapterVaultRelation(relation));
    }
    return lookup;
  }, [adapterRelations]);

  const adapterRelationsByVaultScopedAddress = useMemo(() => {
    const lookup = new Map<string, AdapterVaultRelation[]>();
    for (const relation of adapterRelations) {
      const key = getAddressKey(relation.vaultAddress, relation.chainId);
      const existing = lookup.get(key) ?? [];
      existing.push(toAdapterVaultRelation(relation));
      lookup.set(key, existing);
    }
    return lookup;
  }, [adapterRelations]);

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

      const adapterRelation = chainId
        ? adapterRelationsByScopedAddress.get(getAddressKey(normalizedAddress, chainId))
        : toOptionalAdapterVaultRelation(
            adapterRelations.find((candidate) => candidate.adapterAddress.toLowerCase() === normalizedAddress),
          );

      if (adapterRelation) {
        return adapterRelationToAdapterIdentity(
          adapterRelation,
          getVaultByAddress(toAddress(adapterRelation.vaultAddress), adapterRelation.chainId),
        );
      }

      const vaultRelation = chainId
        ? adapterRelationsByVaultScopedAddress.get(getAddressKey(normalizedAddress, chainId))?.[0]
        : toOptionalAdapterVaultRelation(adapterRelations.find((candidate) => candidate.vaultAddress.toLowerCase() === normalizedAddress));
      if (vaultRelation) {
        return adapterRelationToVaultIdentity(vaultRelation, getVaultByAddress(address, vaultRelation.chainId));
      }

      const vault = getVaultByAddress(address, chainId);
      if (vault) {
        return morphoVaultToIdentity(vault);
      }

      return undefined;
    },
    [adapterRelations, adapterRelationsByScopedAddress, adapterRelationsByVaultScopedAddress, getVaultByAddress],
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
      loading: vaultsLoading || adapterRelationsLoading,
      error: vaultsError ?? adapterRelationsError,
      getVaultByAddress,
      getVaultAccountIdentity,
      getAddressLabel,
    }),
    [
      vaults,
      vaultsLoading,
      adapterRelationsLoading,
      vaultsError,
      adapterRelationsError,
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
