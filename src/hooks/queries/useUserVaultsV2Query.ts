import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { fetchMultipleVaultV2DetailsAcrossNetworks } from '@/data-sources/morpho-api/v2-vaults';
import { fetchUserVaultV2AddressesAllNetworks, type UserVaultV2 } from '@/data-sources/morpho-api/v2-vaults-full';
import { fetchUserVaultShares } from '@/utils/vaultAllocation';
import type { SupportedNetworks } from '@/utils/networks';

type UseUserVaultsV2Options = {
  userAddress?: Address;
  enabled?: boolean;
};

// Vault that is still being indexed by the API
export type IndexingVault = {
  address: string;
  networkId: SupportedNetworks;
};

export type UserVaultsV2Result = {
  vaults: UserVaultV2[];
  indexingVaults: IndexingVault[];
};

function filterValidVaults(vaults: UserVaultV2[]): UserVaultV2[] {
  return vaults.filter((vault) => vault.owner && vault.asset && vault.address);
}

async function fetchAndProcessVaults(userAddress: Address): Promise<UserVaultsV2Result> {
  // Step 1: Fetch vault addresses from Morpho API (filtered by owner client-side)
  const vaultAddresses = await fetchUserVaultV2AddressesAllNetworks(userAddress);

  if (vaultAddresses.length === 0) {
    return { vaults: [], indexingVaults: [] };
  }

  // Step 2: Fetch full vault details from Morpho API (includes adapters)
  const vaultDetails = await fetchMultipleVaultV2DetailsAcrossNetworks(vaultAddresses);

  // Step 3: Filter valid vaults
  const validVaults = filterValidVaults(vaultDetails as UserVaultV2[]);

  // Step 4: Identify vaults that are still indexing (found in localStorage but not in API)
  const indexedAddresses = new Set(validVaults.map((v) => v.address.toLowerCase()));
  const indexingVaults: IndexingVault[] = vaultAddresses
    .filter((v) => !indexedAddresses.has(v.address.toLowerCase()))
    .map((v) => ({ address: v.address, networkId: v.networkId }));

  if (validVaults.length === 0) {
    return { vaults: [], indexingVaults };
  }

  // Step 5: Batch fetch user's share balances via multicall
  const shareBalances = await fetchUserVaultShares(
    validVaults.map((v) => ({ address: v.address as Address, networkId: v.networkId })),
    userAddress,
  );

  // Step 6: Combine all data - adapters are already in vault details
  const vaultsWithBalancesAndAdapters = validVaults.map((vault) => ({
    ...vault,
    // First adapter is the MorphoMarketV1Adapter
    adapter: vault.adapters.length > 0 ? (vault.adapters[0] as Address) : undefined,
    balance: shareBalances.get(vault.address.toLowerCase()) ?? 0n,
  }));

  return { vaults: vaultsWithBalancesAndAdapters, indexingVaults };
}

/**
 * Fetches user's V2 vaults using React Query.
 *
 * Data fetching strategy:
 * - Fetches vault addresses from Morpho API (filtered by owner client-side)
 * - Enriches with vault details from Morpho API (includes adapters)
 * - Fetches user's share balances via multicall
 * - Returns complete vault data with balances
 *
 * Cache behavior:
 * - staleTime: 60 seconds (complex multi-step fetch)
 * - Refetch on window focus: enabled
 * - Only runs when userAddress is provided
 *
 * @example
 * ```tsx
 * const { data: vaults, isLoading, error } = useUserVaultsV2Query({
 *   userAddress: '0x...',
 * });
 * ```
 */
export const useUserVaultsV2Query = (options: UseUserVaultsV2Options = {}) => {
  const { address: connectedAddress } = useConnection();

  const userAddress = (options.userAddress ?? connectedAddress) as Address;
  const enabled = options.enabled ?? true;

  return useQuery<UserVaultsV2Result, Error>({
    queryKey: ['user-vaults-v2', userAddress],
    queryFn: async () => {
      if (!userAddress) {
        return { vaults: [], indexingVaults: [] };
      }

      try {
        return await fetchAndProcessVaults(userAddress);
      } catch (err) {
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch user vaults');
        console.error('Error fetching user V2 vaults:', fetchError);
        throw fetchError;
      }
    },
    enabled: enabled && Boolean(userAddress),
    staleTime: 60_000, // 60 seconds - complex multi-step fetch
    refetchOnWindowFocus: true,
  });
};
