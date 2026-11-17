import { useCallback, useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { vaultv2Abi } from '@/abis/vaultv2';
import { getNetworkConfig, type SupportedNetworks } from '@/utils/networks';
import {
  VAULT_V2_DEFAULT_FORCE_DEALLOCATE_PENALTY,
  VAULT_V2_EXIT_CRITICAL_GATES,
  VAULT_V2_INITIALIZATION_ABDICATED_SELECTORS,
} from '@/utils/vaultV2Setup';
import { useVaultV2DeadDepositQuery } from './queries/useVaultV2DeadDepositQuery';

export type VaultV2MissingSetupRequirement =
  | 'adapter'
  | 'adapterRegistry'
  | 'curator'
  | 'forceDeallocatePenalty'
  | 'setupAbdications'
  | 'deadDeposit';

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
  const deadDeposit = useVaultV2DeadDepositQuery(vaultAddress, chainId);
  const vaultContract = { address: vaultAddressToCheck, abi: vaultv2Abi, chainId } as const;

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
          { ...vaultContract, functionName: 'adapterRegistry' },
          { ...vaultContract, functionName: 'curator' },
          { ...vaultContract, functionName: 'isAdapter', args: [adapterAddressToCheck] },
          { ...vaultContract, functionName: 'forceDeallocatePenalty', args: [adapterAddressToCheck] },
          { ...vaultContract, functionName: 'receiveSharesGate' },
          { ...vaultContract, functionName: 'sendSharesGate' },
          { ...vaultContract, functionName: 'receiveAssetsGate' },
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
    const [registryResult, curatorResult, adapterResult, penaltyResult, ...gateResults] = setupCoreResults ?? [];
    const adapterRegistry = registryResult?.status === 'success' ? (registryResult.result as Address) : undefined;
    const curator = curatorResult?.status === 'success' ? (curatorResult.result as Address) : undefined;
    const isLinkedAdapter = adapterResult?.status === 'success' && adapterResult.result === true;
    const forceDeallocatePenalty = penaltyResult?.status === 'success' ? (penaltyResult.result as bigint) : undefined;
    const setupAbdicationsComplete = VAULT_V2_INITIALIZATION_ABDICATED_SELECTORS.every(
      (_selector, index) => abdicationResults?.[index]?.status === 'success' && abdicationResults[index]?.result === true,
    );
    const exitGatesOpen = VAULT_V2_EXIT_CRITICAL_GATES.every(
      (_gate, index) => gateResults[index]?.status === 'success' && normalizeAddress(gateResults[index]?.result) === zeroAddress,
    );

    const missing: VaultV2MissingSetupRequirement[] = [];

    if (!deadDeposit.data?.isSeeded) missing.push('deadDeposit');

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

    if (!setupAbdicationsComplete || !exitGatesOpen) {
      missing.push('setupAbdications');
    }

    return missing;
  }, [adapterAddress, abdicationResults, deadDeposit.data?.isSeeded, expectedRegistry, setupCoreResults]);

  const refetchSetupStatus = useCallback(async () => {
    const [setupResult] = await Promise.all([refetch(), refetchAbdications(), deadDeposit.refetch()]);
    return setupResult;
  }, [refetch, refetchAbdications, deadDeposit.refetch]);

  return {
    deadDeposit,
    error: error ?? abdicationError ?? deadDeposit.error,
    isComplete:
      enabled && !isLoading && !isLoadingAbdications && !deadDeposit.isPending && !deadDeposit.isError && missingRequirements.length === 0,
    isFetching: isFetching || isFetchingAbdications || deadDeposit.isFetching,
    isLoading: isLoading || isLoadingAbdications || deadDeposit.isPending,
    missingRequirements,
    refetch: refetchSetupStatus,
  };
}
