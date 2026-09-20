import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { fetchUserVaultV2DetailsAllNetworks, type UserVaultV2 } from '@/data-sources/monarch-api/vaults';
import { fetchUserVaultV2PositionReferences } from '@/data-sources/morpho-api/vaults';
import { useCustomRpc, type CustomRpcUrls } from '@/stores/useCustomRpc';
import { fetchUserVaultShares, fetchVaultTotalAssets, getVaultReadKey } from '@/utils/vaultAllocation';
import { fetchVaultYieldSnapshots, type VaultYieldSnapshot } from '@/utils/vaultYield';

type UseUserVaultsV2Options = {
  /** Include deposited/held vaults and return only current positive positions. Defaults to owned vaults. */
  includePositions?: boolean;
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
  includePositions,
  customRpcUrls,
}: {
  includePositions: boolean;
  customRpcUrls: CustomRpcUrls;
  includeApy: boolean;
  includeBalances: boolean;
  includeTotalAssets: boolean;
  userAddress: Address;
}): Promise<UserVaultV2[]> {
  const positions = includePositions ? await fetchUserVaultV2PositionReferences(userAddress) : undefined;
  const validVaults = filterValidVaults(await fetchUserVaultV2DetailsAllNetworks(userAddress, positions));

  if (validVaults.length === 0) {
    return [];
  }

  const shareBalances = includeBalances
    ? await fetchUserVaultShares(
        validVaults.map((vault) => ({ address: vault.address as Address, networkId: vault.networkId })),
        userAddress,
        customRpcUrls,
      )
    : new Map<string, bigint>();
  const visibleVaults = includePositions
    ? validVaults.filter((vault) => (shareBalances.get(getVaultReadKey(vault.address, vault.networkId)) ?? 0n) > 0n)
    : validVaults;
  const vaultReads = visibleVaults.map((vault) => ({ address: vault.address as Address, networkId: vault.networkId }));

  // Do not fetch historical share prices for positions the user has exited.
  const [yieldSnapshotsByVault, totalAssetsByVault] = await Promise.all([
    includeApy ? fetchVaultYieldSnapshots({ vaults: vaultReads, customRpcUrls }) : Promise.resolve(new Map<string, VaultYieldSnapshot>()),
    includeTotalAssets ? fetchVaultTotalAssets(vaultReads, customRpcUrls) : Promise.resolve(new Map<string, bigint>()),
  ]);

  // Combine Monarch vault metadata with optional balances and supplemental APY
  return visibleVaults.map((vault) => {
    const vaultKey = getVaultReadKey(vault.address, vault.networkId);

    return {
      ...vault,
      adapter: vault.adapters[0] as Address | undefined,
      avgApy: yieldSnapshotsByVault.get(vaultKey)?.vaultApy ?? undefined,
      balance: shareBalances.get(vaultKey),
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

  const customRpcUrls = useCustomRpc((state) => state.customRpcUrls);
  const includePositions = options.includePositions ?? false;
  const includeApy = options.includeApy ?? true;
  const includeBalances = includePositions || (options.includeBalances ?? true);
  const includeTotalAssets = options.includeTotalAssets ?? false;
  const userAddress = (options.userAddress ?? connectedAddress)?.toLowerCase() as Address;
  const enabled = options.enabled ?? true;

  return useQuery<UserVaultV2[], Error>({
    queryKey: ['user-vaults-v2', userAddress, { includePositions, includeApy, includeBalances, includeTotalAssets }, customRpcUrls],
    queryFn: async () => {
      if (!userAddress) {
        return [];
      }

      return fetchAndProcessVaults({
        includeApy,
        includeBalances,
        includeTotalAssets,
        userAddress,
        includePositions,
        customRpcUrls,
      });
    },
    enabled: enabled && Boolean(userAddress),
    staleTime: 60_000, // 60 seconds - complex multi-step fetch
    refetchOnWindowFocus: true,
  });
};
