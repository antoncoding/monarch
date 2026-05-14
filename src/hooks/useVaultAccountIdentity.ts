import { useMemo } from 'react';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import type { Address } from 'viem';

export function useVaultAccountIdentity(address?: string, chainId?: number) {
  const { getVaultAccountIdentity } = useVaultRegistry();

  return useMemo(() => {
    if (!address?.startsWith('0x')) {
      return undefined;
    }

    return getVaultAccountIdentity(address as Address, chainId);
  }, [address, chainId, getVaultAccountIdentity]);
}
