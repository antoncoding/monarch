import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { fetchUserVaultV2DetailsAllNetworks, type UserVaultV2 } from '@/data-sources/monarch-api/vaults';
import { fetchUserVaultShares, fetchVaultTotalAssets, getVaultReadKey } from '@/utils/vaultAllocation';
import { fetchVaultYieldSnapshots, type VaultYieldSnapshot } from '@/utils/vaultYield';

type UseUserVaultsV2Options = {
  includeApy?: boolean;
  includeBalances?: boolean;
  includeTotalAssets?: boolean;
  userAddress?: Address;
  enabled?: boolean;
};

function filterValidVaults(vaults: UserVaultV2[]): UserVaultV2[] {
  return vaults.filter((vault) => vault.owner && vault.asset && vault.address);
}

async function fetchAndProcessVaults({
  includeApy,
  includeBalances,
  includeTotalAssets,
  userAddress,
}: {
  includeApy: boolean;
  includeBalances: boolean;
  includeTotalAssets: boolean;
  userAddress: Address;
}): Promise<UserVaultV2[]> {
  const validVaults = filterValidVaults(await fetchUserVaultV2DetailsAllNetworks(userAddress));

  if (validVaults.length === 0) {
    return [];
  }

  const [yieldSnapshotsByVault, shareBalances, totalAssetsByVault] = await Promise.all([
    includeApy
      ? fetchVaultYieldSnapshots({
          vaults: validVaults.map((vault) => ({
            address: vault.address as Address,
            networkId: vault.networkId,
          })),
        })
      : Promise.resolve(new Map<string, VaultYieldSnapshot>()),
    includeBalances
      ? fetchUserVaultShares(
          validVaults.map((v) => ({ address: v.address as Address, networkId: v.networkId })),
          userAddress,
        )
      : Promise.resolve(new Map<string, bigint>()),
    includeTotalAssets
      ? fetchVaultTotalAssets(validVaults.map((v) => ({ address: v.address as Address, networkId: v.networkId })))
      : Promise.resolve(new Map<string, bigint>()),
  ]);

  // Combine Monarch vault metadata with optional balances and supplemental APY
  return validVaults.map((vault) => {
    const vaultKey = getVaultReadKey(vault.address, vault.networkId);

    return {
      ...vault,
      adapter: vault.adapters[0] as Address | undefined,
      avgApy: yieldSnapshotsByVault.get(vaultKey)?.vaultApy ?? undefined,
      balance: includeBalances ? (shareBalances.has(vaultKey) ? shareBalances.get(vaultKey) : undefined) : undefined,
      totalAssets: totalAssetsByVault.get(vaultKey),
    };
  });
}

/**
 * Fetches user's V2 vaults using React Query.
 *
 * Data fetching strategy:
 * - Fetches cross-chain vault details from Monarch API
 * - Optionally enriches current APY from batched RPC share-price yield snapshots
 * - Optionally enriches user's share balances via multicall
 * - Optionally enriches vault total assets via multicall
 * - Returns complete vault data with optional on-chain enrichments
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

  const includeApy = options.includeApy ?? true;
  const includeBalances = options.includeBalances ?? true;
  const includeTotalAssets = options.includeTotalAssets ?? false;
  const userAddress = (options.userAddress ?? connectedAddress) as Address;
  const enabled = options.enabled ?? true;

  return useQuery<UserVaultV2[], Error>({
    queryKey: ['user-vaults-v2', userAddress, { includeApy, includeBalances, includeTotalAssets }],
    queryFn: async () => {
      if (!userAddress) {
        return [];
      }

      try {
        return await fetchAndProcessVaults({ includeApy, includeBalances, includeTotalAssets, userAddress });
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
