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
    const adapterDetailsByAddress = new Map(adapterDetails.map((adapterDetail) => [adapterDetail.address, adapterDetail]));
    const adapterAddresses = [...(query.data?.adapters ?? []), ...adapterDetails.map((adapterDetail) => adapterDetail.address)];
    const seenAddresses = new Set<string>();

    return adapterAddresses.flatMap((adapterAddress) => {
      if (seenAddresses.has(adapterAddress)) {
        return [];
      }

      seenAddresses.add(adapterAddress);
      const adapterDetail = adapterDetailsByAddress.get(adapterAddress);

      return [
        {
          adapter: adapterAddress as Address,
          adapterType: adapterDetail?.adapterType,
          factoryAddress: adapterDetail?.factoryAddress as Address | undefined,
          id: `${chainId}-${vaultAddress ?? 'unknown'}-${adapterAddress}`,
          parentVault: (vaultAddress ?? zeroAddress) as Address,
        },
      ];
    });
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
