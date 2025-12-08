import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, zeroAddress } from 'viem';
import { useAccount, useChainId } from 'wagmi';
import { adapterFactoryAbi } from '@/abis/morpho-market-v1-adapter-factory';
import { getMorphoAddress } from '@/utils/morpho';
import { getNetworkConfig, type SupportedNetworks } from '@/utils/networks';
import { useTransactionWithToast } from './useTransactionWithToast';

const TX_TOAST_ID = 'deploy-morpho-market-adapter';

export function useDeployMorphoMarketV1Adapter({
  vaultAddress,
  chainId,
  morphoAddress,
}: {
  vaultAddress?: Address;
  chainId?: SupportedNetworks | number;
  morphoAddress?: Address;
}) {
  const { address: account } = useAccount();
  const connectedChainId = useChainId();
  const resolvedChainId = (chainId ?? connectedChainId) as SupportedNetworks;

  const factoryAddress = useMemo(() => {
    try {
      return getNetworkConfig(resolvedChainId).vaultConfig?.marketV1AdapterFactory ?? null;
    } catch (_error) {
      return null;
    }
  }, [resolvedChainId]);

  const morpho = useMemo(() => {
    if (morphoAddress) return morphoAddress;
    return getMorphoAddress(resolvedChainId);
  }, [morphoAddress, resolvedChainId]);

  const canDeploy = Boolean(factoryAddress && vaultAddress && morpho && morpho !== zeroAddress);

  const { isConfirming: isDeploying, sendTransactionAsync } = useTransactionWithToast({
    toastId: TX_TOAST_ID,
    pendingText: 'Deploying adapter',
    successText: 'Adapter deployed',
    errorText: 'Failed to deploy adapter',
    pendingDescription: 'Creating Morpho Market V1 adapter for this vault',
    successDescription: 'Adapter created. It may take a few seconds for data to index.',
    chainId: resolvedChainId,
  });

  const deploy = useCallback(async () => {
    if (!canDeploy || !account) return;

    await sendTransactionAsync({
      account,
      to: factoryAddress as Address,
      data: encodeFunctionData({
        abi: adapterFactoryAbi,
        functionName: 'createMorphoMarketV1Adapter',
        args: [vaultAddress as Address, morpho as Address],
      }),
    });
  }, [account, canDeploy, factoryAddress, morpho, sendTransactionAsync, vaultAddress]);

  return {
    deploy,
    isDeploying,
    factoryAddress,
    canDeploy,
  };
}
