import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, zeroAddress } from 'viem';
import { useConnection, useChainId, useReadContract } from 'wagmi';
import { adapterFactoryAbi } from '@/abis/morpho-market-v1-adapter-factory';
import { getNetworkConfig, type SupportedNetworks } from '@/utils/networks';
import { useTransactionWithToast } from './useTransactionWithToast';

const TX_TOAST_ID = 'deploy-morpho-market-adapter';

export function useDeployMorphoMarketV1Adapter({
  vaultAddress,
  chainId,
}: {
  vaultAddress?: Address;
  chainId?: SupportedNetworks | number;
}) {
  const { address: account } = useConnection();
  const connectedChainId = useChainId();
  const resolvedChainId = (chainId ?? connectedChainId) as SupportedNetworks;

  const factoryAddress = useMemo(() => {
    try {
      return getNetworkConfig(resolvedChainId).autovaultAddresses?.marketV1AdapterFactory ?? null;
    } catch (_error) {
      return null;
    }
  }, [resolvedChainId]);

  // Check on-chain if an adapter already exists for this vault
  const { data: existingAdapterOnChain } = useReadContract({
    address: factoryAddress as Address,
    abi: adapterFactoryAbi,
    functionName: 'morphoMarketV1AdapterV2',
    args: vaultAddress ? [vaultAddress] : undefined,
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

  const canDeploy = Boolean(factoryAddress && vaultAddress);

  const { isConfirming: isDeploying, sendTransactionAsync } = useTransactionWithToast({
    toastId: TX_TOAST_ID,
    pendingText: 'Deploying adapter',
    successText: 'Adapter deployed',
    errorText: 'Failed to deploy adapter',
    pendingDescription: 'Creating Morpho Market V1 adapter for this vault',
    successDescription: 'Adapter created. It may take a few seconds for data to index.',
    chainId: resolvedChainId,
  });

  const deploy = useCallback(async (): Promise<`0x${string}` | undefined> => {
    if (!canDeploy || !account) return undefined;

    const txHash = await sendTransactionAsync({
      account,
      to: factoryAddress as Address,
      data: encodeFunctionData({
        abi: adapterFactoryAbi,
        functionName: 'createMorphoMarketV1AdapterV2',
        args: [vaultAddress as Address],
      }),
    });

    return txHash;
  }, [account, canDeploy, factoryAddress, sendTransactionAsync, vaultAddress]);

  return {
    deploy,
    isDeploying,
    factoryAddress,
    canDeploy,
    existingAdapter,
  };
}
