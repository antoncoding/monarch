import { useCallback, useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { adapterV2FactoryAbi } from '@/abis/morpho-market-v1-adapter-v2-factory';
import { useVaultV2Data } from './useVaultV2Data';
import { parseCapIdParams } from '@/utils/morpho';
import { getAgentConfig, type SupportedNetworks } from '@/utils/networks';
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
  const factoryAddress = useMemo(() => {
    try {
      return getAgentConfig(chainId)?.marketAdapterFactory ?? null;
    } catch (_error) {
      return null;
    }
  }, [chainId]);
  const canReadFactoryAdapter = Boolean(vaultAddress && factoryAddress);

  const {
    data: factoryAdapterResults,
    isFetching: isFetchingFactoryAdapter,
    isLoading: isLoadingFactoryAdapter,
    refetch: refetchFactoryAdapter,
  } = useReadContracts({
    contracts:
      vaultAddress && factoryAddress
        ? [
            {
              address: factoryAddress,
              abi: adapterV2FactoryAbi,
              functionName: 'morphoMarketV1AdapterV2',
              args: [vaultAddress],
              chainId,
            },
          ]
        : [],
    query: {
      enabled: canReadFactoryAdapter,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  });

  const factoryAdapter =
    factoryAdapterResults?.[0]?.status === 'success' && factoryAdapterResults[0].result !== zeroAddress
      ? (factoryAdapterResults[0].result.toLowerCase() as Address)
      : undefined;

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
    const adapterAddresses = [
      ...(factoryAdapter ? [factoryAdapter] : []),
      ...(query.data?.adapters ?? []),
      ...adapterDetails.map((adapterDetail) => adapterDetail.address),
    ];
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
            factoryAddress: (adapterDetail?.factoryAddress as Address | undefined) ?? factoryAddress ?? undefined,
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
  }, [capSummaryByAdapter, chainId, factoryAdapter, factoryAddress, query.data?.adapterDetails, query.data?.adapters, vaultAddress]);

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

  const refetch = useCallback(async () => {
    const [queryResult] = await Promise.all([query.refetch(), canReadFactoryAdapter ? refetchFactoryAdapter() : Promise.resolve(null)]);
    return queryResult;
  }, [canReadFactoryAdapter, query.refetch, refetchFactoryAdapter]);

  return {
    primaryAdapter,
    primaryAdapterType,
    primaryFactoryAddress,
    adapters,
    configuredAdapters,
    isFetching: query.isFetching || isFetchingFactoryAdapter,
    isLoading: query.isLoading || isLoadingFactoryAdapter,
    error: query.error,
    refetch,
    isRefetching: query.isRefetching || isFetchingFactoryAdapter,
    hasAdapters: adapters.length > 0,
    hasMultipleAdapters: adapters.length > 1,
  };
}
