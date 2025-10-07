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

  const { data: rawName } = useReadContract({
    address: vaultAddress,
    abi: vaultv2Abi,
    functionName: 'name',
    args: [],
    chainId: chainIdToUse,
    query: {
      enabled: Boolean(vaultAddress),
    },
  });

  const { data: rawSymbol } = useReadContract({
    address: vaultAddress,
    abi: vaultv2Abi,
    functionName: 'symbol',
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

  const { isConfirming: isFinalizing, sendTransactionAsync: sendFinalizeTx } = useTransactionWithToast({
    toastId: 'finalizeSetup',
    pendingText: 'Finalizing setup',
    successText: 'Setup finalized',
    errorText: 'Failed to finalize setup',
    pendingDescription: 'Finalizing setup',
    successDescription: 'Setup finalized',
    chainId: chainIdToUse,
    onSuccess: handleFinalizeSuccess,
  });

  const { isConfirming: isUpdatingMetadata, sendTransactionAsync: sendMetadataTx } = useTransactionWithToast({
    toastId: 'update-vault-metadata',
    pendingText: 'Updating vault metadata',
    successText: 'Vault metadata updated',
    errorText: 'Failed to update vault metadata',
    pendingDescription: 'Applying new name and symbol',
    successDescription: 'Vault metadata saved',
    chainId: chainIdToUse,
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
        await sendFinalizeTx({
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
    [account, chainIdToUse, currentCurator, sendFinalizeTx, vaultAddress],
  );

  const updateNameAndSymbol = useCallback(
    async ({ name, symbol }: { name?: string; symbol?: string }): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const nextName = name?.trim();
      const nextSymbol = symbol?.trim();

      const calls: `0x${string}`[] = [];

      if (nextName) {
        calls.push(
          encodeFunctionData({
            abi: vaultv2Abi,
            functionName: 'setName',
            args: [nextName],
          }),
        );
      }

      if (nextSymbol) {
        calls.push(
          encodeFunctionData({
            abi: vaultv2Abi,
            functionName: 'setSymbol',
            args: [nextSymbol],
          }),
        );
      }

      if (calls.length === 0) {
        return false;
      }

      const txData =
        calls.length === 1
          ? calls[0]
          : encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'multicall',
              args: [calls],
            });

      try {
        await sendMetadataTx({
          account,
          to: vaultAddress,
          data: txData,
          chainId: chainIdToUse,
        });
        return true;
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to update vault metadata', error);
        throw error;
      }
    },
    [account, chainIdToUse, sendMetadataTx, vaultAddress],
  );

  const adapter = useMemo(() => {
    if (!data) return zeroAddress;
    return data as Address;
  }, [data]);

  const name = useMemo(() => {
    if (!rawName) return '';
    return String(rawName);
  }, [rawName]);

  const symbol = useMemo(() => {
    if (!rawSymbol) return '';
    return String(rawSymbol);
  }, [rawSymbol]);

  const needsSetup = adapter === zeroAddress;

  return {
    adapter,
    needsSetup,
    isLoading: isLoading || isFetching,
    refetch,
    error: error as Error | null,
    finalizeSetup,
    isFinalizing,
    name,
    symbol,
    updateNameAndSymbol,
    isUpdatingMetadata,
  };
}
