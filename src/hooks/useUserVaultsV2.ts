import { useState, useEffect, useCallback } from 'react';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';
import { fetchMultipleVaultV2DetailsAcrossNetworks } from '@/data-sources/morpho-api/v2-vaults';
import { fetchUserVaultV2AddressesAllNetworks, type UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { readTotalAsset } from '@/utils/vaultAllocation';

type UseUserVaultsV2Return = {
  vaults: UserVaultV2[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

function filterValidVaults(vaults: UserVaultV2[]): UserVaultV2[] {
  return vaults.filter((vault) => vault.owner && vault.asset && vault.address);
}

async function fetchVaultBalances(vaults: UserVaultV2[]): Promise<UserVaultV2[]> {
  return Promise.all(
    vaults.map(async (vault) => {
      const balance = await readTotalAsset(vault.address as Address, vault.networkId);

      return {
        ...vault,
        balance: balance ?? BigInt(0),
      };
    }),
  );
}

async function fetchAndProcessVaults(address: Address): Promise<UserVaultV2[]> {
  // Step 1: Fetch vault addresses from subgraph across all networks
  const vaultAddresses = await fetchUserVaultV2AddressesAllNetworks(address);

  console.log('vaultAddresses', vaultAddresses);

  if (vaultAddresses.length === 0) {
    return [];
  }

  // Step 2: Fetch full vault details from Morpho API
  const vaultDetails = await fetchMultipleVaultV2DetailsAcrossNetworks(vaultAddresses);

  // Step 3: Filter valid vaults
  const validVaults = filterValidVaults(vaultDetails as UserVaultV2[]);

  // Step 4: Fetch balances for each vault
  const vaultsWithBalances = await fetchVaultBalances(validVaults);

  return vaultsWithBalances;
}

export function useUserVaultsV2(): UseUserVaultsV2Return {
  const { address } = useAccount();
  const [vaults, setVaults] = useState<UserVaultV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVaults = useCallback(async () => {
    if (!address) {
      setVaults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const vaultsWithBalances = await fetchAndProcessVaults(address);
      setVaults(vaultsWithBalances);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch user vaults');
      setError(fetchError);
      console.error('Error fetching user V2 vaults:', fetchError);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void fetchVaults();
  }, [fetchVaults]);

  return {
    vaults,
    loading,
    error,
    refetch: fetchVaults,
  };
}
