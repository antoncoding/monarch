import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'viem';
import { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { SupportedNetworks } from '@/utils/networks';
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

type UseAllocationsReturn = {
  allocations: AllocationData[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useAllocations({
  vaultAddress,
  chainId,
  caps = [],
  enabled = true,
}: UseAllocationsArgs): UseAllocationsReturn {
  const [allocations, setAllocations] = useState<AllocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a stable key from capIds to detect actual changes
  const capsKey = useMemo(() => {
    return caps.map((c) => c.capId).sort().join(',');
  }, [caps]);

  const load = useCallback(async () => {
    if (!vaultAddress || !enabled || caps.length === 0) {
      setAllocations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Read all allocations in parallel
      const allocationPromises = caps.map(async (cap) => {
        const allocation = await readAllocation(
          vaultAddress,
          cap.capId as `0x${string}`,
          chainId,
        );

        return {
          capId: cap.capId,
          allocation,
          cap,
        };
      });

      const results = await Promise.all(allocationPromises);
      setAllocations(results);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch allocations');
      setError(errorObj);
      console.error('Error fetching allocations:', err);
    } finally {
      setLoading(false);
    }
  }, [vaultAddress, chainId, capsKey, enabled]); // Use capsKey instead of caps

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return {
    allocations,
    loading,
    error,
    refetch,
  };
}
