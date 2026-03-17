import { useMemo } from 'react';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { getSlicedAddress } from '@/utils/address';
import type { Address } from 'viem';

type UseAddressLabelReturn = {
  vaultName: string | undefined;
  shortAddress: string;
};

/**
 * Hook to resolve address labels in priority order:
 * 1. Vault name (if address is a known vault)
 * 2. ENS name (handled by Name component)
 * 3. Shortened address (0x1234...5678)
 */
export function useAddressLabel(address: Address, chainId?: number): UseAddressLabelReturn {
  const { getVaultByAddress } = useVaultRegistry();

  const vaultName = useMemo(() => {
    const vaultOnChain = getVaultByAddress(address, chainId);
    if (vaultOnChain?.name) {
      return vaultOnChain.name;
    }

    // Fallback: some surfaces may pass a mismatched/unknown chainId for a known vault address.
    // In that case, resolve by address only so vault labels still render.
    const vaultAnyChain = getVaultByAddress(address);
    return vaultAnyChain?.name;
  }, [address, chainId, getVaultByAddress]);

  const shortAddress = useMemo(() => {
    return getSlicedAddress(address as `0x${string}`);
  }, [address]);

  return {
    vaultName,
    shortAddress,
  };
}
