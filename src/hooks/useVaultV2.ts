import { useCallback, useMemo } from 'react';
import { Address, encodeFunctionData, toFunctionSelector, zeroAddress } from 'viem';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { vaultv2Abi } from '@/abis/vaultv2';
import { SupportedNetworks } from '@/utils/networks';
import { useTransactionWithToast } from './useTransactionWithToast';

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
  const { address: account } = useAccount();

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

  const { data: curator } = useReadContract({
    address: vaultAddress,
    abi: vaultv2Abi,
    functionName: 'curator',
    args: [],
    chainId: chainIdToUse,
    query: {
      enabled: Boolean(vaultAddress),
    },
  });

  const currentCurator = useMemo(() => (curator as Address | undefined) ?? zeroAddress, [curator]);

  const handleFinalizeSuccess = useCallback(() => {
    void refetch();
  }, [refetch]);

  const { isConfirming: isFinalizing, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'finalizeSetup',
    pendingText: 'Finalizing setup',
    successText: 'Setup finalized',
    errorText: 'Failed to finalize setup',
    pendingDescription: 'Finalizing setup',
    successDescription: 'Setup finalized',
    chainId: chainIdToUse,
    onSuccess: handleFinalizeSuccess,
  });

 
  // All morpho v2 vault operations have to be proposed first, and then execute
  const finalizeSetup = useCallback(
    async (morphoRegistry: Address, marketV1Adapter: Address): Promise<boolean> => {
      if (!account || !vaultAddress || marketV1Adapter === zeroAddress) return false;

      const txs: `0x${string}`[] = [];

      // Step 1. Assign curator if unset.
      if (currentCurator === zeroAddress) {
        const setCuratorTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'setCurator',
          args: [account],
        });
        txs.push(setCuratorTx);
      }

      // Step 2. Commit to Morpho registry.
      const setRegistryTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'setAdapterRegistry',
        args: [morphoRegistry],
      });

      const submitSetRegistryTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'submit',
        args: [setRegistryTx],
      });

      txs.push(submitSetRegistryTx, setRegistryTx);

      // Step 3. Register the deployed adapter.
      const addAdapterTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'addAdapter',
        args: [marketV1Adapter],
      });

      const submitAddAdapterTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'submit',
        args: [addAdapterTx],
      });

      txs.push(submitAddAdapterTx, addAdapterTx);

      // Step 4. Abdicate registry control.
      const setAdapterRegistrySelector = toFunctionSelector('setAdapterRegistry(address)');

      const abdicateSetAdapterRegistryTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'abdicate',
        args: [setAdapterRegistrySelector],
      });

      const submitAbdicateSetAdapterRegistryTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'submit',
        args: [abdicateSetAdapterRegistryTx],
      });

      txs.push(submitAbdicateSetAdapterRegistryTx, abdicateSetAdapterRegistryTx);

      // Step 5. Execute multicall with all steps.
      const multicallTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'multicall',
        args: [txs],
      });

      try {
        await sendTransactionAsync({
          account,
          to: vaultAddress,
          data: multicallTx,
          chainId: chainIdToUse,
        });
        return true;
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
          // user rejected the transaction; treat as graceful cancellation
          return false;
        }
        console.error('Failed to finalize vault setup', error);
        throw error;
      }
    },
    [account, chainIdToUse, currentCurator, sendTransactionAsync, vaultAddress],
  );

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
    finalizeSetup,
    isFinalizing,
  };
}
