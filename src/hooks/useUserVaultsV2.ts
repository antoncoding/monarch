import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Track the current fetch to prevent race conditions
  const fetchIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchVaults = useCallback(async () => {
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!address) {
      setVaults([]);
      setLoading(false);
      return;
    }

    // Increment fetch ID and create new abort controller
    const currentFetchId = ++fetchIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      // Check if request was cancelled
      if (abortController.signal.aborted) return;

      const userVaults = await fetchUserVaultsV2AllNetworks(address);

      // Check if this is still the current request
      if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) return;

      // Filter out vaults with incomplete data
      const validVaults = userVaults.filter(vault =>
        vault.owner &&
        vault.asset &&
        vault.newVaultV2
      );

      // Check again before proceeding with balance fetches
      if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) return;

      // Fetch balances for each vault
      const vaultsWithBalances = await Promise.all(
        validVaults.map(async (vault) => {
          // Check cancellation before each balance fetch
          if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) {
            throw new Error('Request cancelled');
          }

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

      // Final check before updating state
      if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) return;

      setVaults(vaultsWithBalances);
    } catch (err) {
      // Only set error if this is still the current request and not cancelled
      if (!abortController.signal.aborted && currentFetchId === fetchIdRef.current) {
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch user vaults');
        setError(fetchError);
        console.error('Error fetching user V2 vaults:', fetchError);
      }
    } finally {
      // Only update loading if this is still the current request
      if (!abortController.signal.aborted && currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [address]);

  // Fetch vaults only when address changes, not when fetchVaults function reference changes
  useEffect(() => {
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!address) {
      setVaults([]);
      setLoading(false);
      return;
    }

    // Increment fetch ID and create new abort controller
    const currentFetchId = ++fetchIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    const doFetch = async () => {
      try {
        // Check if request was cancelled
        if (abortController.signal.aborted) return;

        const userVaults = await fetchUserVaultsV2AllNetworks(address);

        // Check if this is still the current request
        if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) return;

        // Filter out vaults with incomplete data
        const validVaults = userVaults.filter(vault =>
          vault.owner &&
          vault.asset &&
          vault.newVaultV2
        );

        // Check again before proceeding with balance fetches
        if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) return;

        // Fetch balances for each vault
        const vaultsWithBalances = await Promise.all(
          validVaults.map(async (vault) => {
            // Check cancellation before each balance fetch
            if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) {
              throw new Error('Request cancelled');
            }

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

        // Final check before updating state
        if (abortController.signal.aborted || currentFetchId !== fetchIdRef.current) return;

        setVaults(vaultsWithBalances);
      } catch (err) {
        // Only set error if this is still the current request and not cancelled
        if (!abortController.signal.aborted && currentFetchId === fetchIdRef.current) {
          const fetchError = err instanceof Error ? err : new Error('Failed to fetch user vaults');
          setError(fetchError);
          console.error('Error fetching user V2 vaults:', fetchError);
        }
      } finally {
        // Only update loading if this is still the current request
        if (!abortController.signal.aborted && currentFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    };

    void doFetch();
  }, [address]);

  // Cleanup: abort any pending requests when component unmounts or address changes
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [address]);

  return {
    vaults,
    loading,
    error,
    refetch: fetchVaults,
  };
}