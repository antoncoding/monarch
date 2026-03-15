import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useVaultV2Data } from './useVaultV2Data';
import type { SupportedNetworks } from '@/utils/networks';

export type VaultMarketAdapter = {
  adapter: Address;
  adapterType?: string;
  factoryAddress?: Address;
  id: string;
  parentVault: Address;
};

export function useMorphoMarketAdapters({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
  const query = useVaultV2Data({ vaultAddress, chainId });

  const adapters = useMemo<VaultMarketAdapter[]>(() => {
    const adapterDetails = query.data?.adapterDetails ?? [];

    if (adapterDetails.length > 0) {
      return adapterDetails.map((adapterDetail) => ({
        adapter: adapterDetail.address as Address,
        adapterType: adapterDetail.adapterType,
        factoryAddress: adapterDetail.factoryAddress as Address,
        id: `${chainId}-${vaultAddress ?? 'unknown'}-${adapterDetail.address}`,
        parentVault: (vaultAddress ?? zeroAddress) as Address,
      }));
    }

    return (query.data?.adapters ?? []).map((adapterAddress) => ({
      adapter: adapterAddress as Address,
      adapterType: undefined,
      factoryAddress: undefined,
      id: `${chainId}-${vaultAddress ?? 'unknown'}-${adapterAddress}`,
      parentVault: (vaultAddress ?? zeroAddress) as Address,
    }));
  }, [chainId, query.data?.adapterDetails, query.data?.adapters, vaultAddress]);

  const { primaryAdapter, primaryAdapterType, primaryFactoryAddress } = useMemo(() => {
    const primary = adapters[0];

    return {
      primaryAdapter: primary?.adapter,
      primaryAdapterType: primary?.adapterType,
      primaryFactoryAddress: primary?.factoryAddress,
    };
  }, [adapters]);

  return {
    primaryAdapter,
    primaryAdapterType,
    primaryFactoryAddress,
    adapters,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    hasAdapters: adapters.length > 0,
  };
}
