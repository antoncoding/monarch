import { useCallback, useState } from 'react';
import { type QueryClient, useIsFetching, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import type { SupportedNetworks } from '@/utils/networks';

type RefetchVaultQueryDataArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  retryDelaysMs?: readonly number[];
};

const DEFAULT_REFETCH_DELAYS_MS = [0] as const;
export const MONARCH_VAULT_QUERY_REFETCH_DELAYS_MS = [0, 1_500, 5_000] as const;

const wait = async (delayMs: number): Promise<void> => {
  if (delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const refetchVaultQuerySet = async (queryClient: QueryClient, vaultAddress: Address, chainId: SupportedNetworks): Promise<void> => {
  const normalizedVaultAddress = vaultAddress.toLowerCase() as Address;

  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['vault-v2-data', normalizedVaultAddress, chainId], exact: false }),
    queryClient.refetchQueries({ queryKey: ['vault-allocations', vaultAddress, chainId], exact: false }),
    queryClient.refetchQueries({ queryKey: ['user-vaults-v2'], exact: false }),
  ]);
};

export const refetchVaultQueryData = async (
  queryClient: QueryClient,
  { vaultAddress, chainId, retryDelaysMs = DEFAULT_REFETCH_DELAYS_MS }: RefetchVaultQueryDataArgs,
): Promise<void> => {
  if (!vaultAddress) {
    return;
  }

  for (const delayMs of retryDelaysMs) {
    await wait(delayMs);
    await refetchVaultQuerySet(queryClient, vaultAddress, chainId);
  }
};

export function useVaultQueryRefresh({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
  const queryClient = useQueryClient();
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const normalizedVaultAddress = vaultAddress?.toLowerCase() as Address | undefined;
  const vaultDataFetchCount = useIsFetching({ queryKey: ['vault-v2-data', normalizedVaultAddress, chainId] });
  const vaultAllocationFetchCount = useIsFetching({ queryKey: ['vault-allocations', vaultAddress, chainId] });
  const userVaultFetchCount = useIsFetching({ queryKey: ['user-vaults-v2'] });

  const refetch = useCallback(
    async ({ includeRetries = false }: { includeRetries?: boolean } = {}): Promise<void> => {
      setRefreshInProgress(true);
      try {
        await refetchVaultQueryData(queryClient, {
          vaultAddress,
          chainId,
          retryDelaysMs: includeRetries ? MONARCH_VAULT_QUERY_REFETCH_DELAYS_MS : DEFAULT_REFETCH_DELAYS_MS,
        });
      } finally {
        setRefreshInProgress(false);
      }
    },
    [chainId, queryClient, vaultAddress],
  );

  return {
    refetch,
    isRefetching: refreshInProgress || vaultDataFetchCount + vaultAllocationFetchCount + userVaultFetchCount > 0,
  };
}
