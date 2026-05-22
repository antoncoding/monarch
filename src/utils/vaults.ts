import { type TrustedVault, getVaultKey, known_vaults } from '@/constants/vaults/known_vaults';
import type { MorphoVault, MorphoVaultV2Metadata } from '@/data-sources/morpho-api/vaults';
import type { MarketV2SupplyingVault } from '@/data-sources/monarch-api/vaults';
import { getMarketIdentityKey } from '@/utils/market-identity';
import type { Market } from '@/utils/types';

export function getMonarchVaultHref(chainId: number, address: string): string {
  return `/vault/${chainId}/${address}`;
}

export function morphoVaultToTrustedVault(vault: MorphoVault): TrustedVault {
  return {
    address: vault.address as `0x${string}`,
    chainId: vault.chainId,
    name: vault.name,
    asset: vault.assetAddress as `0x${string}`,
    featured: vault.featured,
    metadataDescription: vault.metadataDescription,
    metadataImage: vault.metadataImage,
    source: 'morpho',
  };
}

export function morphoVaultV2MetadataToTrustedVault(vault: MorphoVaultV2Metadata): TrustedVault {
  return {
    address: vault.address as `0x${string}`,
    asset: vault.assetAddress as `0x${string}`,
    chainId: vault.chainId,
    featured: vault.listed,
    metadataDescription: vault.metadataDescription,
    metadataImage: vault.metadataImage,
    name: vault.name || vault.symbol || `Vault ${vault.address.slice(0, 6)}...${vault.address.slice(-4)}`,
    source: 'morpho',
    version: 'v2',
  };
}

function mergeTrustedVaultMetadata(vault: TrustedVault, metadata: TrustedVault): TrustedVault {
  return {
    ...vault,
    name: metadata.name || vault.name,
    asset: metadata.asset || vault.asset,
    featured: metadata.featured ?? vault.featured,
    metadataDescription: metadata.metadataDescription ?? vault.metadataDescription,
    metadataImage: metadata.metadataImage ?? vault.metadataImage,
    source: vault.source ?? metadata.source,
    version: metadata.version ?? vault.version,
  };
}

export function buildTrustedVaultMetadata(morphoVaults: MorphoVault[], metadataVaults: TrustedVault[] = []): TrustedVault[] {
  const metadataByKey = new Map<string, TrustedVault>();

  for (const vault of known_vaults) {
    metadataByKey.set(getVaultKey(vault.address, vault.chainId), vault);
  }

  for (const vault of metadataVaults) {
    const key = getVaultKey(vault.address, vault.chainId);
    const existing = metadataByKey.get(key);
    metadataByKey.set(key, existing ? mergeTrustedVaultMetadata(existing, vault) : vault);
  }

  for (const morphoVault of morphoVaults) {
    const vault = morphoVaultToTrustedVault(morphoVault);
    const key = getVaultKey(vault.address, vault.chainId);
    const existing = metadataByKey.get(key);
    metadataByKey.set(key, existing ? mergeTrustedVaultMetadata(existing, vault) : vault);
  }

  return Array.from(metadataByKey.values());
}

/**
 * Builds a Map of trusted vaults keyed by their vault key (chainId:address)
 * for efficient lookup operations
 *
 * @param vaults - Array of trusted vaults
 * @param metadataVaults - Fresh vault metadata used to hydrate persisted selections
 * @returns Map with vault keys as keys and TrustedVault objects as values
 */
export function buildTrustedVaultMap(vaults: TrustedVault[], metadataVaults: TrustedVault[] = []): Map<string, TrustedVault> {
  const map = new Map<string, TrustedVault>();
  const metadataByKey = new Map<string, TrustedVault>();

  for (const vault of metadataVaults) {
    metadataByKey.set(getVaultKey(vault.address, vault.chainId), vault);
  }

  for (const vault of vaults) {
    const key = getVaultKey(vault.address, vault.chainId);
    const metadata = metadataByKey.get(key);
    map.set(key, metadata ? mergeTrustedVaultMetadata(vault, metadata) : vault);
  }
  return map;
}

const marketV2SupplyingVaultToTrustedVault = (vault: MarketV2SupplyingVault): TrustedVault | null => {
  if (!vault.asset) {
    return null;
  }

  return {
    address: vault.vaultAddress as `0x${string}`,
    asset: vault.asset,
    chainId: vault.chainId,
    metadataDescription: vault.metadataDescription,
    metadataImage: vault.metadataImage,
    name: vault.vaultName,
    source: 'monarch',
    version: 'v2',
  };
};

export function isTrustedVaultV2(vault: TrustedVault): boolean {
  return vault.version === 'v2';
}

export function getTrustedVaultsForMarket(
  market: Market,
  trustedVaultMap: Map<string, TrustedVault>,
  v2SupplyingVaultsLookup?: Map<string, MarketV2SupplyingVault[]>,
): TrustedVault[] {
  if (trustedVaultMap.size === 0) {
    return [];
  }

  const chainId = market.morphoBlue.chain.id;
  const marketIdentityKey = getMarketIdentityKey(chainId, market.uniqueKey);
  const matchesByKey = new Map<string, TrustedVault>();

  for (const vault of market.supplyingVaults ?? []) {
    if (vault.address) {
      const key = getVaultKey(vault.address, chainId);
      if (matchesByKey.has(key)) {
        continue;
      }

      const trusted = trustedVaultMap.get(key);
      if (trusted) {
        matchesByKey.set(key, trusted);
      }
    }
  }

  for (const supplyingVault of v2SupplyingVaultsLookup?.get(marketIdentityKey) ?? []) {
    const vault = marketV2SupplyingVaultToTrustedVault(supplyingVault);
    if (!vault) {
      continue;
    }

    const key = getVaultKey(vault.address, vault.chainId);
    const trusted = trustedVaultMap.get(key);
    if (!trusted) {
      continue;
    }

    const metadataVault = mergeTrustedVaultMetadata(trusted, vault);
    const existing = matchesByKey.get(key);
    matchesByKey.set(key, existing ? mergeTrustedVaultMetadata(existing, metadataVault) : metadataVault);
  }

  return Array.from(matchesByKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatVaultAdapterType(adapterType?: string): string {
  const trimmedAdapterType = adapterType?.trim();
  if (!trimmedAdapterType) {
    return 'Vault adapter';
  }

  return trimmedAdapterType.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\bV\s+(\d+)\b/g, 'V$1');
}
