import { useMemo } from 'react';
import type { Address } from 'viem';
import { useQuery } from '@tanstack/react-query';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import type { SupportedNetworks } from '@/utils/networks';
import { readAllocation } from '@/utils/vaultAllocation';

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

export function useAllocations({ vaultAddress, chainId, caps = [], enabled = true }: UseAllocationsArgs) {
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

      // Read all allocations in parallel
      const allocationPromises = caps.map(async (cap) => {
        const allocation = await readAllocation(vaultAddress, cap.capId as `0x${string}`, chainId);

        return {
          capId: cap.capId,
          allocation,
          cap,
        };
      });

      const results = await Promise.all(allocationPromises);
      return results;
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
