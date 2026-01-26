import { useMemo } from 'react';
import type { Address } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { vaultv2Abi } from '@/abis/vaultv2';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

export type AllocationData = {
  capId: string;
  allocation: bigint;
  cap: VaultV2Cap;
};

type UseAllocationsArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  caps?: VaultV2Cap[];
  enabled?: boolean;
};

export function useAllocationsQuery({ vaultAddress, chainId, caps = [], enabled = true }: UseAllocationsArgs) {
  // Create a stable key from capIds to detect actual changes
  const capsKey = useMemo(() => {
    return caps
      .map((c) => c.capId)
      .sort()
      .join(',');
  }, [caps]);

  const query = useQuery({
    queryKey: ['vault-allocations', vaultAddress, chainId, capsKey],
    queryFn: async () => {
      if (!vaultAddress || caps.length === 0) {
        return [];
      }

      const client = getClient(chainId);
      const contracts = caps.map((cap) => ({
        address: vaultAddress,
        abi: vaultv2Abi,
        functionName: 'allocation' as const,
        args: [cap.capId as `0x${string}`],
      }));

      const results = await client.multicall({ contracts, allowFailure: true });

      return caps.map((cap, i) => ({
        capId: cap.capId,
        allocation: results[i].status === 'success' ? (results[i].result as bigint) : 0n,
        cap,
      }));
    },
    enabled: enabled && Boolean(vaultAddress) && caps.length > 0,
    staleTime: 30_000, // 30 seconds - allocation data is cacheable
  });

  return {
    allocations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
