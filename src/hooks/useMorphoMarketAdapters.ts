import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useVaultV2Data } from './useVaultV2Data';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { hasPositiveVaultCap } from '@/utils/vaultAllocation';

export type VaultMarketAdapter = {
  adapter: Address;
  adapterType?: string;
  factoryAddress?: Address;
  hasPositiveAdapterCap: boolean;
  id: string;
  marketCapCount: number;
  parentVault: Address;
};

type AdapterCapSummary = {
  hasPositiveAdapterCap: boolean;
  marketCapCount: number;
};

const getAddressKey = (address: string | undefined): string => address?.toLowerCase() ?? '';

export function useMorphoMarketAdapters({ vaultAddress, chainId }: { vaultAddress?: Address; chainId: SupportedNetworks }) {
  const query = useVaultV2Data({ vaultAddress, chainId });

  const capSummaryByAdapter = useMemo(() => {
    const summaries = new Map<string, AdapterCapSummary>();
    const ensureSummary = (adapterAddress: string): AdapterCapSummary => {
      const key = getAddressKey(adapterAddress);
      const summary = summaries.get(key) ?? { hasPositiveAdapterCap: false, marketCapCount: 0 };
      summaries.set(key, summary);
      return summary;
    };

    for (const cap of query.data?.capsData?.adapterCaps ?? []) {
      const parsed = parseCapIdParams(cap.idParams);
      if (parsed.type !== 'adapter' || !parsed.adapterAddress) {
        continue;
      }

      const summary = ensureSummary(parsed.adapterAddress);
      summary.hasPositiveAdapterCap ||= hasPositiveVaultCap(cap);
    }

    for (const cap of query.data?.capsData?.marketCaps ?? []) {
      const parsed = parseCapIdParams(cap.idParams);
      if (parsed.type !== 'market' || !parsed.adapterAddress || !hasPositiveVaultCap(cap)) {
        continue;
      }

      const summary = ensureSummary(parsed.adapterAddress);
      summary.marketCapCount += 1;
    }

    return summaries;
  }, [query.data?.capsData?.adapterCaps, query.data?.capsData?.marketCaps]);

  const adapters = useMemo<VaultMarketAdapter[]>(() => {
    const adapterDetails = query.data?.adapterDetails ?? [];
    const adapterDetailsByAddress = new Map(adapterDetails.map((adapterDetail) => [getAddressKey(adapterDetail.address), adapterDetail]));
    const adapterAddresses = [...(query.data?.adapters ?? []), ...adapterDetails.map((adapterDetail) => adapterDetail.address)];
    const seenAddresses = new Set<string>();

    return adapterAddresses
      .flatMap((adapterAddress) => {
        const adapterKey = getAddressKey(adapterAddress);
        if (seenAddresses.has(adapterKey)) {
          return [];
        }

        seenAddresses.add(adapterKey);
        const adapterDetail = adapterDetailsByAddress.get(adapterKey);
        const capSummary = capSummaryByAdapter.get(adapterKey);

        return [
          {
            adapter: adapterKey as Address,
            adapterType: adapterDetail?.adapterType,
            factoryAddress: adapterDetail?.factoryAddress as Address | undefined,
            hasPositiveAdapterCap: capSummary?.hasPositiveAdapterCap ?? false,
            id: `${chainId}-${vaultAddress ?? 'unknown'}-${adapterKey}`,
            marketCapCount: capSummary?.marketCapCount ?? 0,
            parentVault: (vaultAddress ?? zeroAddress) as Address,
          },
        ];
      })
      .sort((left, right) => {
        if (left.marketCapCount !== right.marketCapCount) {
          return right.marketCapCount - left.marketCapCount;
        }

        if (left.hasPositiveAdapterCap !== right.hasPositiveAdapterCap) {
          return left.hasPositiveAdapterCap ? -1 : 1;
        }

        return 0;
      });
  }, [capSummaryByAdapter, chainId, query.data?.adapterDetails, query.data?.adapters, vaultAddress]);

  const configuredAdapters = useMemo(
    () => adapters.filter((adapter) => adapter.marketCapCount > 0 || adapter.hasPositiveAdapterCap),
    [adapters],
  );

  const { primaryAdapter, primaryAdapterType, primaryFactoryAddress } = useMemo(() => {
    const primary = configuredAdapters[0] ?? adapters[0];

    return {
      primaryAdapter: primary?.adapter,
      primaryAdapterType: primary?.adapterType,
      primaryFactoryAddress: primary?.factoryAddress,
    };
  }, [adapters, configuredAdapters]);

  return {
    primaryAdapter,
    primaryAdapterType,
    primaryFactoryAddress,
    adapters,
    configuredAdapters,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    hasAdapters: adapters.length > 0,
    hasMultipleAdapters: adapters.length > 1,
  };
}
