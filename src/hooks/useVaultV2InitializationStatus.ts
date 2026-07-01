import { useCallback, useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { vaultv2Abi } from '@/abis/vaultv2';
import { getNetworkConfig, type SupportedNetworks } from '@/utils/networks';
import { VAULT_V2_DEFAULT_FORCE_DEALLOCATE_PENALTY, VAULT_V2_INITIALIZATION_ABDICATED_SELECTORS } from '@/utils/vaultV2Setup';

export type VaultV2MissingSetupRequirement = 'adapter' | 'adapterRegistry' | 'curator' | 'forceDeallocatePenalty' | 'setupAbdications';

const normalizeAddress = (value: unknown): string => (typeof value === 'string' ? value.toLowerCase() : '');

export function useVaultV2InitializationStatus({
  adapterAddress,
  chainId,
  vaultAddress,
}: {
  adapterAddress?: Address;
  chainId: SupportedNetworks;
  vaultAddress?: Address;
}) {
  const expectedRegistry = useMemo(() => {
    try {
      return getNetworkConfig(chainId).vaultConfig?.morphoRegistry;
    } catch (_error) {
      return undefined;
    }
  }, [chainId]);

  const vaultAddressToCheck = vaultAddress ?? zeroAddress;
  const adapterAddressToCheck = adapterAddress ?? zeroAddress;
  const enabled = vaultAddressToCheck !== zeroAddress;

  const {
    data: setupCoreResults,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useReadContracts({
    allowFailure: true,
    contracts: enabled
      ? [
          {
            address: vaultAddressToCheck,
            abi: vaultv2Abi,
            functionName: 'adapterRegistry',
            args: [],
            chainId,
          },
          {
            address: vaultAddressToCheck,
            abi: vaultv2Abi,
            functionName: 'curator',
            args: [],
            chainId,
          },
          {
            address: vaultAddressToCheck,
            abi: vaultv2Abi,
            functionName: 'isAdapter',
            args: [adapterAddressToCheck],
            chainId,
          },
          {
            address: vaultAddressToCheck,
            abi: vaultv2Abi,
            functionName: 'forceDeallocatePenalty',
            args: [adapterAddressToCheck],
            chainId,
          },
        ]
      : [],
    query: {
      enabled,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  });

  const {
    data: abdicationResults,
    error: abdicationError,
    isFetching: isFetchingAbdications,
    isLoading: isLoadingAbdications,
    refetch: refetchAbdications,
  } = useReadContracts({
    allowFailure: true,
    contracts: enabled
      ? VAULT_V2_INITIALIZATION_ABDICATED_SELECTORS.map((selector) => ({
          address: vaultAddressToCheck,
          abi: vaultv2Abi,
          functionName: 'abdicated' as const,
          args: [selector],
          chainId,
        }))
      : [],
    query: {
      enabled,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  });

  const missingRequirements = useMemo<VaultV2MissingSetupRequirement[]>(() => {
    const adapterRegistry = setupCoreResults?.[0]?.status === 'success' ? (setupCoreResults[0].result as Address) : undefined;
    const curator = setupCoreResults?.[1]?.status === 'success' ? (setupCoreResults[1].result as Address) : undefined;
    const isLinkedAdapter = setupCoreResults?.[2]?.status === 'success' ? setupCoreResults[2].result === true : false;
    const forceDeallocatePenalty = setupCoreResults?.[3]?.status === 'success' ? (setupCoreResults[3].result as bigint) : undefined;
    const setupAbdicationsComplete = VAULT_V2_INITIALIZATION_ABDICATED_SELECTORS.every(
      (_selector, index) => abdicationResults?.[index]?.status === 'success' && abdicationResults[index]?.result === true,
    );

    const missing: VaultV2MissingSetupRequirement[] = [];

    if (!adapterAddress || adapterAddress === zeroAddress || !isLinkedAdapter) {
      missing.push('adapter');
    }

    if (expectedRegistry && normalizeAddress(adapterRegistry) !== expectedRegistry.toLowerCase()) {
      missing.push('adapterRegistry');
    }

    if (!curator || curator === zeroAddress) {
      missing.push('curator');
    }

    if (adapterAddress && adapterAddress !== zeroAddress && forceDeallocatePenalty !== VAULT_V2_DEFAULT_FORCE_DEALLOCATE_PENALTY) {
      missing.push('forceDeallocatePenalty');
    }

    if (!setupAbdicationsComplete) {
      missing.push('setupAbdications');
    }

    return missing;
  }, [adapterAddress, abdicationResults, expectedRegistry, setupCoreResults]);

  const refetchSetupStatus = useCallback(async () => {
    const [setupResult] = await Promise.all([refetch(), refetchAbdications()]);
    return setupResult;
  }, [refetch, refetchAbdications]);

  return {
    error: error ?? abdicationError,
    isComplete: enabled && !isLoading && !isLoadingAbdications && missingRequirements.length === 0,
    isFetching: isFetching || isFetchingAbdications,
    isLoading: isLoading || isLoadingAbdications,
    missingRequirements,
    refetch: refetchSetupStatus,
  };
}
