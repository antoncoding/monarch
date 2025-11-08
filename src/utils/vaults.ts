import { type TrustedVault, getVaultKey } from '@/constants/vaults/known_vaults';

/**
 * Builds a Map of trusted vaults keyed by their vault key (chainId:address)
 * for efficient lookup operations
 *
 * @param vaults - Array of trusted vaults
 * @returns Map with vault keys as keys and TrustedVault objects as values
 */
export function buildTrustedVaultMap(vaults: TrustedVault[]): Map<string, TrustedVault> {
  const map = new Map<string, TrustedVault>();
  vaults.forEach((vault) => {
    map.set(getVaultKey(vault.address, vault.chainId), vault);
  });
  return map;
}
