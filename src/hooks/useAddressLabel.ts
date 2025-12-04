import { useMemo } from 'react';
import type { Address } from 'viem';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { getSlicedAddress } from '@/utils/address';

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
    const vault = getVaultByAddress(address, chainId);
    return vault?.name;
  }, [address, chainId, getVaultByAddress]);

  const shortAddress = useMemo(() => {
    return getSlicedAddress(address as `0x${string}`);
  }, [address]);

  return {
    vaultName,
    shortAddress,
  };
}
