import { useState, useEffect, useCallback } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { fetchMorphoMarketV1Adapters } from '@/data-sources/subgraph/morpho-market-v1-adapters';
import { fetchMultipleVaultV2DetailsAcrossNetworks } from '@/data-sources/morpho-api/v2-vaults';
import { fetchUserVaultV2AddressesAllNetworks, type UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { getMorphoAddress } from '@/utils/morpho';
import { getNetworkConfig } from '@/utils/networks';
import { fetchUserVaultShares } from '@/utils/vaultAllocation';

type UseUserVaultsV2Return = {
  vaults: UserVaultV2[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

function filterValidVaults(vaults: UserVaultV2[]): UserVaultV2[] {
  return vaults.filter((vault) => vault.owner && vault.asset && vault.address);
}

async function fetchAndProcessVaults(userAddress: Address): Promise<UserVaultV2[]> {
  // Step 1: Fetch vault addresses from subgraph across all networks
  const vaultAddresses = await fetchUserVaultV2AddressesAllNetworks(userAddress);

  if (vaultAddresses.length === 0) {
    return [];
  }

  // Step 2: Fetch full vault details from Morpho API
  const vaultDetails = await fetchMultipleVaultV2DetailsAcrossNetworks(vaultAddresses);

  // Step 3: Filter valid vaults
  const validVaults = filterValidVaults(vaultDetails as UserVaultV2[]);

  if (validVaults.length === 0) {
    return [];
  }

  // Step 4: Batch fetch adapters from subgraph for each vault
  const adapterPromises = validVaults.map(async (vault) => {
    const networkConfig = getNetworkConfig(vault.networkId);
    const subgraphUrl = networkConfig?.vaultConfig?.adapterSubgraphEndpoint;

    if (!subgraphUrl) {
      return { vaultAddress: vault.address, adapter: undefined };
    }

    try {
      const morphoAddress = getMorphoAddress(vault.networkId);
      const adapters = await fetchMorphoMarketV1Adapters({
        subgraphUrl,
        parentVault: vault.address as Address,
        morpho: morphoAddress as Address,
      });

      return {
        vaultAddress: vault.address,
        adapter: adapters.length > 0 ? adapters[0].adapter : undefined,
      };
    } catch (error) {
      console.error(`Failed to fetch adapter for vault ${vault.address}:`, error);
      return { vaultAddress: vault.address, adapter: undefined };
    }
  });

  const adapterResults = await Promise.all(adapterPromises);
  const adapterMap = new Map(adapterResults.map((r) => [r.vaultAddress.toLowerCase(), r.adapter]));

  // Step 5: Batch fetch user's share balances via multicall
  const shareBalances = await fetchUserVaultShares(
    validVaults.map((v) => ({ address: v.address as Address, networkId: v.networkId })),
    userAddress,
  );

  // Step 6: Combine all data
  const vaultsWithBalancesAndAdapters = validVaults.map((vault) => ({
    ...vault,
    adapter: adapterMap.get(vault.address.toLowerCase()),
    balance: shareBalances.get(vault.address.toLowerCase()) ?? 0n,
  }));

  return vaultsWithBalancesAndAdapters;
}

export function useUserVaultsV2(account?: string): UseUserVaultsV2Return {
  const { address: connectedAddress } = useConnection();
  const [vaults, setVaults] = useState<UserVaultV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use provided account or fall back to connected address
  const targetAddress = account ?? connectedAddress;

  const fetchVaults = useCallback(async () => {
    if (!targetAddress) {
      setVaults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const vaultsWithBalances = await fetchAndProcessVaults(targetAddress as Address);
      setVaults(vaultsWithBalances);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch user vaults');
      setError(fetchError);
      console.error('Error fetching user V2 vaults:', fetchError);
    } finally {
      setLoading(false);
    }
  }, [targetAddress]);

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
