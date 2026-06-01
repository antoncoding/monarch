import { useMemo } from 'react';
import { getVaultKey, monarch_suggested_vaults, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useTrustedVaults } from '@/stores/useTrustedVaults';

const vaultKey = (vault: TrustedVault) => getVaultKey(vault.address, vault.chainId);

export function buildEffectiveTrustedVaults(userTrustedVaults: TrustedVault[], includeMonarchSuggestedVaults: boolean) {
  const vaultsByKey = new Map<string, TrustedVault>();

  if (includeMonarchSuggestedVaults) {
    for (const vault of monarch_suggested_vaults) {
      vaultsByKey.set(vaultKey(vault), vault);
    }
  }

  for (const vault of userTrustedVaults) {
    vaultsByKey.set(vaultKey(vault), vault);
  }

  return Array.from(vaultsByKey.values());
}

export function useEffectiveTrustedVaults() {
  const userTrustedVaults = useTrustedVaults((state) => state.vaults);
  const includeMonarchSuggestedVaults = useTrustedVaults((state) => state.includeMonarchSuggestedVaults);

  return useMemo(
    () => buildEffectiveTrustedVaults(userTrustedVaults, includeMonarchSuggestedVaults),
    [includeMonarchSuggestedVaults, userTrustedVaults],
  );
}
