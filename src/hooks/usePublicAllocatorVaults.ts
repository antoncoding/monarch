import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicAllocatorVaults, type PublicAllocatorVault } from '@/data-sources/morpho-api/public-allocator-vaults';
import type { SupportedNetworks } from '@/utils/networks';

export type FlowCapsByMarket = Map<string, { maxIn: bigint; maxOut: bigint }>;

export type ProcessedPublicAllocatorVault = PublicAllocatorVault & {
  /** Flow caps keyed by market uniqueKey */
  flowCapsByMarket: FlowCapsByMarket;
  /** PA fee as bigint */
  feeBigInt: bigint;
};

/**
 * Hook that batch-fetches all supplying vaults for a market and filters to
 * those with public allocator enabled. Returns processed data with flow caps
 * mapped by market ID for easy lookup.
 */
export function usePublicAllocatorVaults(supplyingVaultAddresses: string[], chainId: SupportedNetworks) {
  const addressesKey = supplyingVaultAddresses.sort().join(',');

  const {
    data: rawVaults,
    isLoading,
    error,
    refetch,
  } = useQuery<PublicAllocatorVault[]>({
    queryKey: ['public-allocator-vaults', addressesKey, chainId],
    queryFn: () => fetchPublicAllocatorVaults(supplyingVaultAddresses, chainId),
    enabled: supplyingVaultAddresses.length > 0,
    staleTime: 30_000,
  });

  // Process vaults: build flow cap maps and parse fee
  const vaults: ProcessedPublicAllocatorVault[] = useMemo(() => {
    if (!rawVaults) return [];

    return rawVaults.map((vault) => {
      const flowCapsByMarket: FlowCapsByMarket = new Map();

      for (const cap of vault.publicAllocatorConfig.flowCaps) {
        flowCapsByMarket.set(cap.market.uniqueKey, {
          maxIn: BigInt(cap.maxIn),
          maxOut: BigInt(cap.maxOut),
        });
      }

      return {
        ...vault,
        flowCapsByMarket,
        feeBigInt: BigInt(vault.publicAllocatorConfig.fee),
      };
    });
  }, [rawVaults]);

  return {
    vaults,
    isLoading,
    error,
    refetch,
  };
}
