import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useVaultV2Data } from './useVaultV2Data';
import type { SupportedNetworks } from '@/utils/networks';

export function useMorphoMarketV1Adapters({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
  const query = useVaultV2Data({ vaultAddress, chainId });

  const adapters = useMemo(
    () =>
      (query.data?.adapters ?? []).map((adapterAddress) => ({
        adapter: adapterAddress as Address,
        id: `${chainId}-${vaultAddress ?? 'unknown'}-${adapterAddress}`,
        parentVault: (vaultAddress ?? zeroAddress) as Address,
      })),
    [chainId, query.data?.adapters, vaultAddress],
  );

  const morphoMarketV1Adapter = useMemo(() => (adapters.length > 0 ? adapters[0].adapter : zeroAddress), [adapters]);

  return {
    morphoMarketV1Adapter,
    adapters,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    hasAdapters: adapters.length > 0,
  };
}
