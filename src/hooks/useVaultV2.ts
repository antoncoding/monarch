import { useMemo } from 'react';
import { Address, zeroAddress } from 'viem';
import { useChainId, useReadContract } from 'wagmi';
import { vaultv2Abi } from '@/abis/vaultv2';
import { SupportedNetworks } from '@/utils/networks';

const ADAPTER_INDEX = 0n;

export function useVaultV2({
  vaultAddress,
  chainId,
}: {
  vaultAddress?: Address;
  chainId?: SupportedNetworks | number;
}) {
  const connectedChainId = useChainId();
  const chainIdToUse = (chainId ?? connectedChainId) as SupportedNetworks;

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useReadContract({
    address: vaultAddress,
    abi: vaultv2Abi,
    functionName: 'adapters',
    args: [ADAPTER_INDEX],
    chainId: chainIdToUse,
    query: {
      enabled: Boolean(vaultAddress),
    },
  });

  const adapter = useMemo(() => {
    if (!data) return zeroAddress;
    return data as Address;
  }, [data]);

  const needsSetup = adapter === zeroAddress;

  return {
    adapter,
    needsSetup,
    isLoading: isLoading || isFetching,
    refetch,
    error: error as Error | null,
  };
}
