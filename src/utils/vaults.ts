import { type TrustedVault, getVaultKey, known_vaults } from '@/constants/vaults/known_vaults';
import type { MorphoVault } from '@/data-sources/morpho-api/vaults';
import type { Market } from '@/utils/types';

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

function mergeTrustedVaultMetadata(vault: TrustedVault, metadata: TrustedVault): TrustedVault {
  return {
    ...vault,
    name: metadata.name || vault.name,
    asset: metadata.asset || vault.asset,
    featured: metadata.featured ?? vault.featured,
    metadataDescription: metadata.metadataDescription ?? vault.metadataDescription,
    metadataImage: metadata.metadataImage ?? vault.metadataImage,
    source: vault.source ?? metadata.source,
  };
}

export function buildTrustedVaultMetadata(morphoVaults: MorphoVault[]): TrustedVault[] {
  const metadataByKey = new Map<string, TrustedVault>();

  for (const vault of known_vaults) {
    metadataByKey.set(getVaultKey(vault.address, vault.chainId), vault);
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

export function getTrustedVaultsForMarket(market: Market, trustedVaultMap: Map<string, TrustedVault>): TrustedVault[] {
  if (!market.supplyingVaults?.length || trustedVaultMap.size === 0) {
    return [];
  }

  const chainId = market.morphoBlue.chain.id;
  const seen = new Set<string>();
  const matches: TrustedVault[] = [];

  for (const vault of market.supplyingVaults) {
    if (vault.address) {
      const key = getVaultKey(vault.address, chainId);
      if (!seen.has(key)) {
        seen.add(key);

        const trusted = trustedVaultMap.get(key);
        if (trusted) {
          matches.push(trusted);
        }
      }
    }
  }

  return matches.sort((a, b) => a.name.localeCompare(b.name));
}

export function isMarketTrustedByVault(market: Market, trustedVaultMap: Map<string, TrustedVault>): boolean {
  if (!market.supplyingVaults?.length || trustedVaultMap.size === 0) {
    return false;
  }

  const chainId = market.morphoBlue.chain.id;

  for (const vault of market.supplyingVaults) {
    if (vault.address && trustedVaultMap.has(getVaultKey(vault.address, chainId))) {
      return true;
    }
  }

  return false;
}

export function formatVaultAdapterType(adapterType?: string): string {
  if (!adapterType) {
    return 'Morpho market adapter';
  }

  return adapterType.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\bV\s+(\d+)\b/g, 'V$1');
}
