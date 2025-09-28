import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { fetchUserVaultsV2AllNetworks, UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { getERC20Balance } from '@/utils/erc20';

type UseUserVaultsV2Return = {
  vaults: UserVaultV2[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

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
      const userVaults = await fetchUserVaultsV2AllNetworks(address);

      // Filter out vaults with incomplete data
      const validVaults = userVaults.filter(vault =>
        vault.owner &&
        vault.asset &&
        vault.newVaultV2
      );

      // Fetch balances for each vault
      const vaultsWithBalances = await Promise.all(
        validVaults.map(async (vault) => {
          const balance = await getERC20Balance(
            vault.asset as Address,
            vault.newVaultV2 as Address,
            vault.networkId
          );

          return {
            ...vault,
            balance: balance ? balance : BigInt(0),
          };
        })
      );

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