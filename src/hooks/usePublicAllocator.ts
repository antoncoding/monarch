import { useMemo } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useReadContract, useReadContracts, useSwitchChain } from 'wagmi';
import { publicAllocatorAbi } from '@/abis/public-allocator';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import type { SupportedNetworks } from '@/utils/networks';

type FlowCapResult = {
  marketId: `0x${string}`;
  maxIn: bigint;
  maxOut: bigint;
};

type UsePublicAllocatorArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  /** Market IDs (uniqueKeys as bytes32) to query flow caps for */
  marketIds?: `0x${string}`[];
  onSuccess?: () => void;
};

/**
 * Hook for interacting with the Public Allocator contract.
 *
 * Provides:
 * - `fee`: The ETH fee required for reallocation for the given vault
 * - `flowCaps`: Flow cap data (maxIn, maxOut) for each requested market
 * - `reallocate`: Function to execute `reallocateTo` on the Public Allocator
 */
export function usePublicAllocator({ vaultAddress, chainId, marketIds, onSuccess }: UsePublicAllocatorArgs) {
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[chainId];
  const isSupported = !!allocatorAddress;

  const { mutateAsync: switchChainAsync } = useSwitchChain();

  // Read the ETH fee for this vault
  const {
    data: feeData,
    isLoading: isFeeLoading,
    refetch: refetchFee,
  } = useReadContract({
    address: allocatorAddress,
    abi: publicAllocatorAbi,
    functionName: 'fee',
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId,
    query: {
      enabled: isSupported && !!vaultAddress,
    },
  });

  const fee = feeData !== undefined ? BigInt(feeData) : 0n;

  // Build flow cap read calls
  const flowCapCalls = useMemo(() => {
    if (!allocatorAddress || !vaultAddress || !marketIds?.length) return [];
    return marketIds.map((marketId) => ({
      address: allocatorAddress as Address,
      abi: publicAllocatorAbi,
      functionName: 'flowCaps' as const,
      args: [vaultAddress, marketId] as const,
      chainId,
    }));
  }, [allocatorAddress, vaultAddress, marketIds, chainId]);

  const {
    data: flowCapsData,
    isLoading: isFlowCapsLoading,
    refetch: refetchFlowCaps,
  } = useReadContracts({
    contracts: flowCapCalls,
    query: {
      enabled: flowCapCalls.length > 0,
    },
  });

  // Parse flow caps results
  const flowCaps: FlowCapResult[] = useMemo(() => {
    if (!flowCapsData || !marketIds?.length) return [];
    return marketIds.map((marketId, i) => {
      const result = flowCapsData[i];
      if (result?.status === 'success' && Array.isArray(result.result)) {
        const [maxIn, maxOut] = result.result as [bigint, bigint];
        return { marketId, maxIn, maxOut };
      }
      return { marketId, maxIn: 0n, maxOut: 0n };
    });
  }, [flowCapsData, marketIds]);

  // Transaction hook for reallocateTo
  const { sendTransaction, isConfirming } = useTransactionWithToast({
    toastId: 'public-allocator-reallocate',
    pendingText: 'Reallocating Liquidity',
    successText: 'Reallocation Complete',
    errorText: 'Reallocation Failed',
    chainId,
    pendingDescription: 'Moving liquidity between markets via the Public Allocator...',
    successDescription: 'Liquidity has been successfully reallocated',
    onSuccess: () => {
      void refetchFee();
      void refetchFlowCaps();
      onSuccess?.();
    },
  });

  /**
   * Execute a reallocation from source markets to the target market.
   *
   * @param withdrawals - Array of { marketParams, amount } sorted by market ID ascending
   * @param supplyMarketParams - The target market to supply to
   */
  const reallocate = async (
    withdrawals: {
      marketParams: {
        loanToken: Address;
        collateralToken: Address;
        oracle: Address;
        irm: Address;
        lltv: bigint;
      };
      amount: bigint;
    }[],
    supplyMarketParams: {
      loanToken: Address;
      collateralToken: Address;
      oracle: Address;
      irm: Address;
      lltv: bigint;
    },
  ) => {
    if (!allocatorAddress || !vaultAddress) return;

    await switchChainAsync({ chainId });

    sendTransaction({
      to: allocatorAddress,
      data: encodeFunctionData({
        abi: publicAllocatorAbi,
        functionName: 'reallocateTo',
        args: [vaultAddress, withdrawals, supplyMarketParams],
      }),
      value: fee,
      chainId,
    });
  };

  return {
    isSupported,
    fee,
    isFeeLoading,
    flowCaps,
    isFlowCapsLoading,
    reallocate,
    isConfirming,
  };
}
