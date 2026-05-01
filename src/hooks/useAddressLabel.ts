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
 * 1. Vault name (if address is a known vault or recognized vault adapter)
 * 2. ENS name (handled by Name component)
 * 3. Shortened address (0x1234...5678)
 */
export function useAddressLabel(address: Address, chainId?: number): UseAddressLabelReturn {
  const { getAddressLabel } = useVaultRegistry();

  const addressLabel = useMemo(() => getAddressLabel(address, chainId), [address, chainId, getAddressLabel]);

  const shortAddress = useMemo(() => {
    return getSlicedAddress(address as `0x${string}`);
  }, [address]);

  return {
    vaultName: addressLabel?.displayName,
    shortAddress,
  };
}
