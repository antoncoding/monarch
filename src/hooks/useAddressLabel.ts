import { useMemo } from 'react';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { getSlicedAddress } from '@/utils/address';
import type { Address } from 'viem';
import type { VaultAccountIdentity } from '@/contexts/VaultRegistryContext';

type UseAddressLabelReturn = {
  vaultName: string | undefined;
  vaultIdentity: VaultAccountIdentity | undefined;
  shortAddress: string;
};

/**
 * Hook to resolve address labels in priority order:
 * 1. Vault name (if address is a known vault or recognized vault adapter)
 * 2. ENS name (handled by Name component)
 * 3. Shortened address (0x1234...5678)
 */
export function useAddressLabel(address: Address, chainId?: number): UseAddressLabelReturn {
  const { getVaultAccountIdentity } = useVaultRegistry();

  const vaultIdentity = useMemo(() => getVaultAccountIdentity(address, chainId), [address, chainId, getVaultAccountIdentity]);

  const shortAddress = useMemo(() => {
    return getSlicedAddress(address as `0x${string}`);
  }, [address]);

  return {
    vaultName: vaultIdentity?.displayName,
    vaultIdentity,
    shortAddress,
  };
}
