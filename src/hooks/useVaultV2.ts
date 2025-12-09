import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, toFunctionSelector, zeroAddress } from 'viem';
import { useConnection, useChainId, useReadContract } from 'wagmi';
import { vaultv2Abi } from '@/abis/vaultv2';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import type { SupportedNetworks } from '@/utils/networks';
import { useTransactionWithToast } from './useTransactionWithToast';

export function useVaultV2({
  vaultAddress,
  chainId,
  onTransactionSuccess,
}: {
  vaultAddress?: Address;
  chainId?: SupportedNetworks | number;
  onTransactionSuccess?: () => void;
}) {
  const connectedChainId = useChainId();
  const chainIdToUse = (chainId ?? connectedChainId) as SupportedNetworks;
  const { address: account } = useConnection();

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

  // Read totalAssets directly from the vault contract
  const {
    data: totalAssets,
    refetch: refetchBalance,
    isLoading: loadingBalance,
  } = useReadContract({
    address: vaultAddress,
    abi: vaultv2Abi,
    functionName: 'totalAssets',
    chainId: chainIdToUse,
    query: {
      enabled: Boolean(vaultAddress),
    },
  });

  const currentCurator = useMemo(() => (curator as Address | undefined) ?? zeroAddress, [curator]);

  const refetchAll = useCallback(() => {
    void refetchBalance();
  }, [refetchBalance]);

  const handleInitializationSuccess = useCallback(() => {
    void refetchAll();
    onTransactionSuccess?.();
  }, [refetchAll, onTransactionSuccess]);

  const { isConfirming: isInitializing, sendTransactionAsync: sendInitializationTx } = useTransactionWithToast({
    toastId: 'completeInitialization',
    pendingText: 'Completing vault initialization',
    successText: 'Vault initialized successfully',
    errorText: 'Failed to initialize vault',
    pendingDescription: 'Setting up adapter, registry, and optional allocator',
    successDescription: 'Vault is ready to use',
    chainId: chainIdToUse,
    onSuccess: handleInitializationSuccess,
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

  const { isConfirming: isUpdatingAllocator, sendTransactionAsync: sendAllocatorTx } = useTransactionWithToast({
    toastId: 'update-allocator',
    pendingText: 'Updating allocator',
    successText: 'Allocator updated',
    errorText: 'Failed to update allocator',
    pendingDescription: 'Updating allocator status',
    successDescription: 'Allocator status changed',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  const { isConfirming: isUpdatingCaps, sendTransactionAsync: sendCapsTx } = useTransactionWithToast({
    toastId: 'update-caps',
    pendingText: 'Updating market caps',
    successText: 'Market caps updated',
    errorText: 'Failed to update caps',
    pendingDescription: 'Applying new market caps',
    successDescription: 'Caps updated successfully',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  // All morpho v2 vault operations have to be proposed first, and then execute
  const completeInitialization = useCallback(
    async (morphoRegistry: Address, marketV1Adapter: Address, allocator?: Address): Promise<boolean> => {
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

      // Step 5 (Optional). Set initial allocator if provided.
      if (allocator && allocator !== zeroAddress) {
        const setAllocatorTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'setIsAllocator',
          args: [allocator, true],
        });

        const submitSetAllocatorTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'submit',
          args: [setAllocatorTx],
        });

        txs.push(submitSetAllocatorTx, setAllocatorTx);
      }

      // Step 6. Execute multicall with all steps.
      const multicallTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'multicall',
        args: [txs],
      });

      try {
        await sendInitializationTx({
          account,
          to: vaultAddress,
          data: multicallTx,
          chainId: chainIdToUse,
        });
        return true;
      } catch (initError) {
        if (initError instanceof Error && initError.message.toLowerCase().includes('reject')) {
          // user rejected the transaction; treat as graceful cancellation
          return false;
        }
        console.error('Failed to complete vault initialization', initError);
        throw initError;
      }
    },
    [account, chainIdToUse, currentCurator, sendInitializationTx, vaultAddress],
  );

  const updateNameAndSymbol = useCallback(
    async ({ name: newName, symbol: newSymbol }: { name?: string; symbol?: string }): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const nextName = newName?.trim();
      const nextSymbol = newSymbol?.trim();

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
      } catch (metadataUpdateError) {
        if (metadataUpdateError instanceof Error && metadataUpdateError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to update vault metadata', metadataUpdateError);
        throw metadataUpdateError;
      }
    },
    [account, chainIdToUse, sendMetadataTx, vaultAddress],
  );

  const setAllocator = useCallback(
    async (allocator: Address, isAllocator: boolean): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const setAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'setIsAllocator',
        args: [allocator, isAllocator],
      });

      const submitSetAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'submit',
        args: [setAllocatorTx],
      });

      const multicallTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'multicall',
        args: [[submitSetAllocatorTx, setAllocatorTx]],
      });

      try {
        await sendAllocatorTx({
          account,
          to: vaultAddress,
          data: multicallTx,
          chainId: chainIdToUse,
        });
        return true;
      } catch (allocatorError) {
        if (allocatorError instanceof Error && allocatorError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to update allocator', allocatorError);
        throw allocatorError;
      }
    },
    [account, chainIdToUse, sendAllocatorTx, vaultAddress],
  );

  const updateCaps = useCallback(
    async (caps: VaultV2Cap[]): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const txs: `0x${string}`[] = [];

      caps.forEach((cap) => {
        const newRelativeCap = BigInt(cap.relativeCap);
        const newAbsoluteCap = BigInt(cap.absoluteCap);
        const oldRelativeCap = cap.oldRelativeCap ? BigInt(cap.oldRelativeCap) : 0n;
        const oldAbsoluteCap = cap.oldAbsoluteCap ? BigInt(cap.oldAbsoluteCap) : 0n;
        const idData = cap.idParams as `0x${string}`;

        // Handle relative cap delta
        if (newRelativeCap !== oldRelativeCap) {
          if (newRelativeCap > oldRelativeCap) {
            // Increase
            const increaseRelativeCapTx = encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'increaseRelativeCap',
              args: [idData, newRelativeCap],
            });

            const submitIncreaseRelativeCapTx = encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'submit',
              args: [increaseRelativeCapTx],
            });

            txs.push(submitIncreaseRelativeCapTx, increaseRelativeCapTx);
          } else if (newRelativeCap < oldRelativeCap) {
            // Decrease, no need to use submit for timelock
            const decreaseRelativeCapTx = encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'decreaseRelativeCap',
              args: [idData, newRelativeCap],
            });
            txs.push(decreaseRelativeCapTx);
          }
        }

        // Handle absolute cap delta
        if (newAbsoluteCap !== oldAbsoluteCap) {
          if (newAbsoluteCap > oldAbsoluteCap) {
            // Increase
            const increaseAbsoluteCapTx = encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'increaseAbsoluteCap',
              args: [idData, newAbsoluteCap],
            });

            const submitIncreaseAbsoluteCapTx = encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'submit',
              args: [increaseAbsoluteCapTx],
            });

            txs.push(submitIncreaseAbsoluteCapTx, increaseAbsoluteCapTx);
          } else if (newAbsoluteCap < oldAbsoluteCap) {
            // Decrease
            const decreaseAbsoluteCapTx = encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'decreaseAbsoluteCap',
              args: [idData, newAbsoluteCap],
            });

            const submitDecreaseAbsoluteCapTx = encodeFunctionData({
              abi: vaultv2Abi,
              functionName: 'submit',
              args: [decreaseAbsoluteCapTx],
            });

            txs.push(submitDecreaseAbsoluteCapTx, decreaseAbsoluteCapTx);
          }
        }
      });

      if (txs.length === 0) {
        console.log('No cap changes detected');
        return false;
      }

      const multicallTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'multicall',
        args: [txs],
      });

      try {
        await sendCapsTx({
          account,
          to: vaultAddress,
          data: multicallTx,
          chainId: chainIdToUse,
        });
        return true;
      } catch (capsError) {
        if (capsError instanceof Error && capsError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to update caps', capsError);
        throw capsError;
      }
    },
    [account, chainIdToUse, sendCapsTx, vaultAddress],
  );

  const { isConfirming: isDepositing, sendTransactionAsync: sendDepositTx } = useTransactionWithToast({
    toastId: 'vault-deposit',
    pendingText: 'Depositing to vault',
    successText: 'Deposit successful',
    errorText: 'Failed to deposit',
    pendingDescription: 'Depositing assets to vault',
    successDescription: 'Assets deposited successfully',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  const { isConfirming: isWithdrawing, sendTransactionAsync: sendWithdrawTx } = useTransactionWithToast({
    toastId: 'vault-withdraw',
    pendingText: 'Withdrawing from vault',
    successText: 'Withdrawal successful',
    errorText: 'Failed to withdraw',
    pendingDescription: 'Withdrawing assets from vault',
    successDescription: 'Assets withdrawn successfully',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  const deposit = useCallback(
    async (amount: bigint, receiver: Address): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const depositTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'deposit',
        args: [amount, receiver],
      });

      try {
        await sendDepositTx({
          account,
          to: vaultAddress,
          data: depositTx,
          chainId: chainIdToUse,
        });
        return true;
      } catch (depositError) {
        if (depositError instanceof Error && depositError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to deposit to vault', depositError);
        throw depositError;
      }
    },
    [account, chainIdToUse, sendDepositTx, vaultAddress],
  );

  const withdraw = useCallback(
    async (amount: bigint, receiver: Address, owner: Address): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const withdrawTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'withdraw',
        args: [amount, receiver, owner],
      });

      try {
        await sendWithdrawTx({
          account,
          to: vaultAddress,
          data: withdrawTx,
          chainId: chainIdToUse,
        });
        return true;
      } catch (withdrawError) {
        if (withdrawError instanceof Error && withdrawError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to withdraw from vault', withdrawError);
        throw withdrawError;
      }
    },
    [account, chainIdToUse, sendWithdrawTx, vaultAddress],
  );

  const name = useMemo(() => {
    if (!rawName) return '';
    return String(rawName);
  }, [rawName]);

  const symbol = useMemo(() => {
    if (!rawSymbol) return '';
    return String(rawSymbol);
  }, [rawSymbol]);

  return {
    isLoading: loadingBalance,
    refetch: refetchAll,
    completeInitialization,
    isInitializing,
    name,
    symbol,
    updateNameAndSymbol,
    isUpdatingMetadata,
    setAllocator,
    isUpdatingAllocator,
    updateCaps,
    isUpdatingCaps,
    deposit,
    isDepositing,
    withdraw,
    isWithdrawing,
    totalAssets,
  };
}
