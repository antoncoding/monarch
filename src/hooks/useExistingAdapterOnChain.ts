import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useChainId, useReadContract } from 'wagmi';
import { adapterFactoryAbi } from '@/abis/morpho-market-v1-adapter-factory';
import { getNetworkConfig, type SupportedNetworks } from '@/utils/networks';

/**
 * Hook to check on-chain if a MorphoMarketV1 adapter exists for a given vault.
 * This is useful as a fallback when the Morpho API hasn't indexed the adapter yet.
 */
export function useExistingAdapterOnChain({
  vaultAddress,
  chainId,
}: {
  vaultAddress?: Address;
  chainId?: SupportedNetworks | number;
}) {
  const connectedChainId = useChainId();
  const resolvedChainId = (chainId ?? connectedChainId) as SupportedNetworks;

  const factoryAddress = useMemo(() => {
    try {
      return getNetworkConfig(resolvedChainId).autovaultAddresses?.marketV1AdapterFactory ?? null;
    } catch (_error) {
      return null;
    }
  }, [resolvedChainId]);

  const { data: existingAdapterOnChain, isLoading } = useReadContract({
    address: factoryAddress ?? zeroAddress,
    abi: adapterFactoryAbi,
    functionName: 'morphoMarketV1AdapterV2',
    args: [vaultAddress ?? zeroAddress],
    chainId: resolvedChainId,
    query: {
      enabled: Boolean(factoryAddress && vaultAddress),
    },
  });

  // Adapter exists if it's not the zero address
  const existingAdapter = useMemo(() => {
    if (!existingAdapterOnChain || existingAdapterOnChain === zeroAddress) {
      return null;
    }
    return existingAdapterOnChain as Address;
  }, [existingAdapterOnChain]);

  return {
    existingAdapter,
    factoryAddress,
    isLoading,
  };
}
