import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { fetchUserVaultsV2AllNetworks, UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { readTotalAsset } from '@/utils/vaultAllocation';

type UseUserVaultsV2Return = {
  vaults: UserVaultV2[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

function filterValidVaults(vaults: UserVaultV2[]): UserVaultV2[] {
  return vaults.filter(vault =>
    vault.owner &&
    vault.asset &&
    vault.newVaultV2
  );
}

async function fetchVaultBalances(vaults: UserVaultV2[]): Promise<UserVaultV2[]> {
  return Promise.all(
    vaults.map(async (vault) => {
      const balance = await readTotalAsset(
        vault.newVaultV2 as Address,
        vault.networkId
      );

      return {
        ...vault,
        balance: balance ?? BigInt(0),
      };
    })
  );
}

async function fetchAndProcessVaults(address: Address): Promise<UserVaultV2[]> {
  const userVaults = await fetchUserVaultsV2AllNetworks(address);
  const validVaults = filterValidVaults(userVaults);
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
