import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, zeroAddress } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useConnection, useChainId, useReadContracts } from 'wagmi';
import { vaultv2Abi } from '@/abis/vaultv2';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import type { SupportedNetworks } from '@/utils/networks';
import { useTransactionWithToast } from './useTransactionWithToast';
import type { Market } from '@/utils/types';
import { encodeMarketParams } from '@/utils/morpho';
import { useVaultKeysCache } from '@/stores/useVaultKeysCache';

export type PerformanceFeeConfig = {
  fee: bigint;
  recipient: Address;
};

/**
 * Builds timelocked transaction calls for setting performance fee recipient and fee.
 * Recipient must be set before fee. Returns submit + execute calls for each.
 */
function buildPerformanceFeeCalls(config: PerformanceFeeConfig): `0x${string}`[] {
  const txs: `0x${string}`[] = [];

  // Set recipient first (required before setting fee)
  const setRecipientTx = encodeFunctionData({
    abi: vaultv2Abi,
    functionName: 'setPerformanceFeeRecipient',
    args: [config.recipient],
  });

  const submitSetRecipientTx = encodeFunctionData({
    abi: vaultv2Abi,
    functionName: 'submit',
    args: [setRecipientTx],
  });

  txs.push(submitSetRecipientTx, setRecipientTx);

  // Then set fee
  const setFeeTx = encodeFunctionData({
    abi: vaultv2Abi,
    functionName: 'setPerformanceFee',
    args: [config.fee],
  });

  const submitSetFeeTx = encodeFunctionData({
    abi: vaultv2Abi,
    functionName: 'submit',
    args: [setFeeTx],
  });

  txs.push(submitSetFeeTx, setFeeTx);

  return txs;
}

/**
 * @notice Reading and Writing hook (via wagmi) for Morpho V2 Vaults
 */
export function useVaultV2({
  vaultAddress,
  chainId,
  connectedAddress,
  onTransactionSuccess,
}: {
  vaultAddress?: Address;
  chainId?: SupportedNetworks | number;
  connectedAddress?: Address;
  onTransactionSuccess?: () => void;
}) {
  const connectedChainId = useChainId();
  const chainIdToUse = (chainId ?? connectedChainId) as SupportedNetworks;
  const { address: account } = useConnection();
  const queryClient = useQueryClient();
  const { addAllocators: cacheAllocators, addCaps: cacheCaps } = useVaultKeysCache(vaultAddress, chainIdToUse);

  const vaultContract = {
    address: vaultAddress ?? zeroAddress,
    abi: vaultv2Abi,
    chainId: chainIdToUse,
  };

  const {
    data: batchData,
    refetch: refetchAll,
    isRefetching,
    isLoading,
  } = useReadContracts({
    contracts: [
      {
        // owner
        ...vaultContract,
        functionName: 'owner',
        args: [],
      },
      {
        // curator
        ...vaultContract,
        functionName: 'curator',
        args: [],
      },
      {
        // name
        ...vaultContract,
        functionName: 'name',
        args: [],
      },
      {
        // symbol
        ...vaultContract,
        functionName: 'symbol',
        args: [],
      },
      {
        // totalAssets
        ...vaultContract,
        functionName: 'totalAssets',
        args: [],
      },
      {
        // balanceOf (user's share balance)
        ...vaultContract,
        functionName: 'balanceOf',
        args: [connectedAddress ?? zeroAddress],
      },
      {
        // totalSupply (for share-to-asset conversion)
        ...vaultContract,
        functionName: 'totalSupply',
        args: [],
      },
    ],
    query: {
      enabled: vaultContract.address !== zeroAddress,
    },
  });

  const [owner, curator, name, symbol, totalAssets, userShares, totalSupply] = useMemo(() => {
    return [
      batchData?.[0].result ?? zeroAddress,
      batchData?.[1].result ?? zeroAddress,
      batchData?.[2].result ?? '',
      batchData?.[3].result ?? '',
      batchData?.[4].result ?? 0n,
      batchData?.[5].result ?? 0n,
      batchData?.[6].result ?? 0n,
    ];
  }, [batchData]);

  // ERC4626: convert user's shares to underlying asset value
  const userAssets = useMemo(() => {
    if (!connectedAddress || userShares === 0n || totalSupply === 0n) return undefined;
    return (userShares * totalAssets) / totalSupply;
  }, [connectedAddress, userShares, totalAssets, totalSupply]);

  const { isConfirming: isInitializing, sendTransactionAsync: sendInitializationTx } = useTransactionWithToast({
    toastId: `init-${vaultAddress ?? 'unknown'}`,
    pendingText: 'Completing vault initialization',
    successText: 'Vault initialized successfully',
    errorText: 'Failed to initialize vault',
    pendingDescription: 'Setting up adapter, registry, and optional allocator',
    successDescription: 'Vault is ready to use',
    chainId: chainIdToUse,
    onSuccess: () => {
      void refetchAll();
      void queryClient.invalidateQueries({ queryKey: ['vault-v2-data', vaultAddress, chainIdToUse] });
      onTransactionSuccess?.();
    },
  });

  const { isConfirming: isUpdatingMetadata, sendTransactionAsync: sendMetadataTx } = useTransactionWithToast({
    toastId: `metadata-${vaultAddress ?? 'unknown'}`,
    pendingText: 'Updating vault metadata',
    successText: 'Vault metadata updated',
    errorText: 'Failed to update vault metadata',
    pendingDescription: 'Applying new name and symbol',
    successDescription: 'Vault metadata saved',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  const { isConfirming: isUpdatingAllocator, sendTransactionAsync: sendAllocatorTx } = useTransactionWithToast({
    toastId: `allocator-${vaultAddress ?? 'unknown'}`,
    pendingText: 'Updating allocator',
    successText: 'Allocator updated',
    errorText: 'Failed to update allocator',
    pendingDescription: 'Updating allocator status',
    successDescription: 'Allocator status changed',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  const { isConfirming: isSwappingAllocator, sendTransactionAsync: sendSwapAllocatorTx } = useTransactionWithToast({
    toastId: `swap-allocator-${vaultAddress ?? 'unknown'}`,
    pendingText: 'Swapping allocator',
    successText: 'Allocators swapped',
    errorText: 'Failed to swap allocators',
    pendingDescription: 'Changing from old to new allocator',
    successDescription: 'Allocators swapped successfully',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  const { isConfirming: isUpdatingCaps, sendTransactionAsync: sendCapsTx } = useTransactionWithToast({
    toastId: `caps-${vaultAddress ?? 'unknown'}`,
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
    async (morphoRegistry: Address, marketV1Adapter: Address, allocator?: Address, _name?: string, _symbol?: string): Promise<boolean> => {
      if (!account || !vaultAddress || marketV1Adapter === zeroAddress) return false;

      const txs: `0x${string}`[] = [];

      // Step 0 (Optional). Set vault metadata if provided (no timelock needed)
      if (_name?.trim()) {
        const setNameTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'setName',
          args: [_name.trim()],
        });
        txs.push(setNameTx);
      }

      if (_symbol?.trim()) {
        const setSymbolTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'setSymbol',
          args: [_symbol.trim()],
        });
        txs.push(setSymbolTx);
      }

      // Step 1. Assign curator if unset.
      if (curator === zeroAddress) {
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

      // Note: Adapter cap will be set when user configures market caps in settings
      // (EditCaps.tsx automatically ensures adapter cap is 100% + maxUint128)

      // Note: do not do this for maximized flexibility for now: open in the future!
      // Step 5. Abdicate registry control.
      // const setAdapterRegistrySelector = toFunctionSelector('setAdapterRegistry(address)');

      // const abdicateSetAdapterRegistryTx = encodeFunctionData({
      //   abi: vaultv2Abi,
      //   functionName: 'abdicate',
      //   args: [setAdapterRegistrySelector],
      // });

      // const submitAbdicateSetAdapterRegistryTx = encodeFunctionData({
      //   abi: vaultv2Abi,
      //   functionName: 'submit',
      //   args: [abdicateSetAdapterRegistryTx],
      // });

      // txs.push(submitAbdicateSetAdapterRegistryTx, abdicateSetAdapterRegistryTx);

      // Step 6.1 Set user as allocator (for withdrawal / setting Withdrawal Data)
      const setSelfAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'setIsAllocator',
        args: [account, true],
      });

      const submitSetSelfAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'submit',
        args: [setSelfAllocatorTx],
      });

      txs.push(submitSetSelfAllocatorTx, setSelfAllocatorTx);

      // Step 6.2 As allocator, set max apy
      const setMaxAPYTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'setMaxRate',
        args: [63419583967n], // max max rate = 200e16 / (86400 * 365) // 200% APR
      });

      txs.push(setMaxAPYTx);

      // Step 6.3 (Optional). Set initial allocator if provided.
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

      // Step 7. Execute multicall with all steps.
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
    [account, chainIdToUse, curator, sendInitializationTx, vaultAddress],
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
    async (allocator: Address, isAllocator: boolean, performanceFeeConfig?: PerformanceFeeConfig): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const txs: `0x${string}`[] = [];

      // Build allocator transaction calls
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

      txs.push(submitSetAllocatorTx, setAllocatorTx);

      // Add performance fee calls if provided (when adding or removing allocator)
      if (performanceFeeConfig !== undefined) {
        txs.push(...buildPerformanceFeeCalls(performanceFeeConfig));
      }

      const multicallTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'multicall',
        args: [txs],
      });

      try {
        await sendAllocatorTx({
          account,
          to: vaultAddress,
          data: multicallTx,
          chainId: chainIdToUse,
        });

        // Push to cache so RPC picks it up instantly on next refetch
        if (isAllocator) {
          cacheAllocators([allocator]);
        }
        void queryClient.invalidateQueries({ queryKey: ['vault-v2-data', vaultAddress, chainIdToUse] });

        return true;
      } catch (allocatorError) {
        if (allocatorError instanceof Error && allocatorError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to update allocator', allocatorError);
        throw allocatorError;
      }
    },
    [account, chainIdToUse, sendAllocatorTx, vaultAddress, cacheAllocators],
  );

  const swapAllocator = useCallback(
    async (oldAllocator: Address, newAllocator: Address, performanceFeeConfig?: PerformanceFeeConfig): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const txs: `0x${string}`[] = [];

      // Remove old allocator
      const removeAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'setIsAllocator',
        args: [oldAllocator, false],
      });

      const submitRemoveAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'submit',
        args: [removeAllocatorTx],
      });

      txs.push(submitRemoveAllocatorTx, removeAllocatorTx);

      // Add new allocator
      const addAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'setIsAllocator',
        args: [newAllocator, true],
      });

      const submitAddAllocatorTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'submit',
        args: [addAllocatorTx],
      });

      txs.push(submitAddAllocatorTx, addAllocatorTx);

      // Add performance fee calls if provided
      if (performanceFeeConfig !== undefined) {
        txs.push(...buildPerformanceFeeCalls(performanceFeeConfig));
      }

      const multicallTx = encodeFunctionData({
        abi: vaultv2Abi,
        functionName: 'multicall',
        args: [txs],
      });

      try {
        await sendSwapAllocatorTx({
          account,
          to: vaultAddress,
          data: multicallTx,
          chainId: chainIdToUse,
        });

        // Push new allocator to cache
        cacheAllocators([newAllocator]);
        void queryClient.invalidateQueries({ queryKey: ['vault-v2-data', vaultAddress, chainIdToUse] });

        return true;
      } catch (swapError) {
        if (swapError instanceof Error && swapError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to swap allocator', swapError);
        throw swapError;
      }
    },
    [account, chainIdToUse, sendSwapAllocatorTx, vaultAddress, cacheAllocators, queryClient],
  );

  const updateCaps = useCallback(
    async (caps: VaultV2Cap[]): Promise<boolean> => {
      if (!account || !vaultAddress) {
        console.warn('updateCaps: Missing account or vault address', { account: !!account, vaultAddress: !!vaultAddress });
        return false;
      }

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
        console.warn('updateCaps: No transactions to execute - caps data may have no actual changes', { capsCount: caps.length });
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

        // Push cap keys to cache so RPC picks them up instantly on next refetch
        cacheCaps(caps.map((cap) => ({ capId: cap.capId, idParams: cap.idParams })));
        void queryClient.invalidateQueries({ queryKey: ['vault-v2-data', vaultAddress, chainIdToUse] });
        void queryClient.invalidateQueries({ queryKey: ['vault-allocations', vaultAddress, chainIdToUse] });

        return true;
      } catch (capsError) {
        if (capsError instanceof Error && capsError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to update caps', capsError);
        throw capsError;
      }
    },
    [account, chainIdToUse, sendCapsTx, vaultAddress, cacheCaps],
  );

  const { isConfirming: isDepositing, sendTransactionAsync: sendDepositTx } = useTransactionWithToast({
    toastId: `deposit-${vaultAddress ?? 'unknown'}`,
    pendingText: 'Depositing to vault',
    successText: 'Deposit successful',
    errorText: 'Failed to deposit',
    pendingDescription: 'Depositing assets to vault',
    successDescription: 'Assets deposited successfully',
    chainId: chainIdToUse,
    onSuccess: onTransactionSuccess,
  });

  const { isConfirming: isWithdrawing, sendTransactionAsync: sendWithdrawTx } = useTransactionWithToast({
    toastId: `withdraw-${vaultAddress ?? 'unknown'}`,
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

  /**
   * Simple withdraw - no market deallocation.
   * Used by regular depositors who just want to withdraw their assets.
   */
  const withdraw = useCallback(
    async (amount: bigint, receiver: Address): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      try {
        const withdrawTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'withdraw',
          args: [amount, receiver, account],
        });

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

  /**
   * Withdraw from a specific market.
   * Sets liquidityAdapter to deallocate from the specified market before withdrawing.
   * Optionally sets caller as allocator if they're not already.
   */
  const withdrawFromMarket = useCallback(
    async (amount: bigint, receiver: Address, market: Market, liquidityAdapter: Address, setSelfAsAllocator: boolean): Promise<boolean> => {
      if (!account || !vaultAddress) return false;

      const txs: `0x${string}`[] = [];

      try {
        // Step 1: Set self as allocator if needed
        if (setSelfAsAllocator) {
          const setAllocatorTx = encodeFunctionData({
            abi: vaultv2Abi,
            functionName: 'setIsAllocator',
            args: [account, true],
          });
          const submitSetAllocatorTx = encodeFunctionData({
            abi: vaultv2Abi,
            functionName: 'submit',
            args: [setAllocatorTx],
          });
          txs.push(submitSetAllocatorTx, setAllocatorTx);
        }

        // Step 2: Set liquidity adapter to deallocate from the market
        const liquidityAdapterTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'setLiquidityAdapterAndData',
          args: [liquidityAdapter, encodeMarketParams(market)],
        });
        txs.push(liquidityAdapterTx);

        // Step 3: Execute the withdraw
        const withdrawTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'withdraw',
          args: [amount, receiver, account],
        });
        txs.push(withdrawTx);

        const multicallTx = encodeFunctionData({
          abi: vaultv2Abi,
          functionName: 'multicall',
          args: [txs],
        });

        await sendWithdrawTx({
          account,
          to: vaultAddress,
          data: multicallTx,
          chainId: chainIdToUse,
        });

        return true;
      } catch (withdrawError) {
        if (withdrawError instanceof Error && withdrawError.message.toLowerCase().includes('reject')) {
          return false;
        }
        console.error('Failed to withdraw from market', withdrawError);
        throw withdrawError;
      }
    },
    [account, chainIdToUse, sendWithdrawTx, vaultAddress],
  );

  const isOwner = useMemo(
    () => Boolean(owner && connectedAddress && owner.toLowerCase() === connectedAddress.toLowerCase()),
    [owner, connectedAddress],
  );

  return {
    isLoading,
    isRefetching,
    refetch: refetchAll,
    completeInitialization,
    isInitializing,
    name,
    symbol,
    owner,
    isOwner,
    updateNameAndSymbol,
    isUpdatingMetadata,
    setAllocator,
    swapAllocator,
    isUpdatingAllocator: isUpdatingAllocator || isSwappingAllocator,
    updateCaps,
    isUpdatingCaps,
    deposit,
    isDepositing,
    withdraw,
    withdrawFromMarket,
    isWithdrawing,
    totalAssets,
    userAssets,
  };
}
