import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection, useChainId } from 'wagmi';
import { adapterV2FactoryAbi } from '@/abis/morpho-market-v1-adapter-v2-factory';
import { type SupportedNetworks, getAgentConfig } from '@/utils/networks';
import { useTransactionWithToast } from './useTransactionWithToast';

const TX_TOAST_ID = 'deploy-morpho-market-adapter';

export function useDeployMorphoMarketAdapter({ vaultAddress, chainId }: { vaultAddress?: Address; chainId?: SupportedNetworks | number }) {
  const { address: account } = useConnection();
  const connectedChainId = useChainId();
  const resolvedChainId = (chainId ?? connectedChainId) as SupportedNetworks;

  const factoryAddress = useMemo(() => {
    try {
      return getAgentConfig(resolvedChainId)?.marketAdapterFactory ?? null;
    } catch (_error) {
      return null;
    }
  }, [resolvedChainId]);

  const canDeploy = Boolean(factoryAddress && vaultAddress);

  const { isConfirming: isDeploying, sendTransactionAsync } = useTransactionWithToast({
    toastId: TX_TOAST_ID,
    pendingText: 'Deploying adapter',
    successText: 'Adapter deployed',
    errorText: 'Failed to deploy adapter',
    pendingDescription: 'Creating Morpho market adapter V2 for this vault',
    successDescription: 'Adapter created. It may take a few seconds for data to index.',
    chainId: resolvedChainId,
  });

  const deploy = useCallback(async (): Promise<`0x${string}` | undefined> => {
    if (!canDeploy || !account || !factoryAddress || !vaultAddress) return undefined;

    const txHash = await sendTransactionAsync({
      account,
      to: factoryAddress,
      data: encodeFunctionData({
        abi: adapterV2FactoryAbi,
        functionName: 'createMorphoMarketV1AdapterV2',
        args: [vaultAddress],
      }),
    });

    return txHash;
  }, [account, canDeploy, factoryAddress, sendTransactionAsync, vaultAddress]);

  return {
    canDeploy,
    deploy,
    factoryAddress,
    isDeploying,
  };
}
