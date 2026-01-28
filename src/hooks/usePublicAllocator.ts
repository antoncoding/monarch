import { type Address, encodeFunctionData } from 'viem';
import { useSwitchChain } from 'wagmi';
import { publicAllocatorAbi } from '@/abis/public-allocator';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import type { SupportedNetworks } from '@/utils/networks';

type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

type UsePublicAllocatorArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  /** Fee in wei (from API publicAllocatorConfig.fee) */
  fee?: bigint;
  onSuccess?: () => void;
};

/**
 * Hook for executing Public Allocator transactions.
 *
 * Flow cap data and fees now come from the Morpho API (via usePublicAllocatorVaults),
 * so this hook only handles transaction execution.
 *
 * Provides:
 * - `reallocate`: Low-level function to execute `reallocateTo` on the Public Allocator
 * - `pullLiquidity`: Higher-level function that handles sorting and execution
 * - `isConfirming`: Whether a transaction is pending confirmation
 */
export function usePublicAllocator({ vaultAddress, chainId, fee = 0n, onSuccess }: UsePublicAllocatorArgs) {
  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[chainId];
  const isSupported = !!allocatorAddress;

  const { mutateAsync: switchChainAsync } = useSwitchChain();

  // Transaction hook for reallocateTo
  const { sendTransactionAsync, isConfirming } = useTransactionWithToast({
    toastId: 'public-allocator-reallocate',
    pendingText: 'Reallocating Liquidity',
    successText: 'Reallocation Complete',
    errorText: 'Reallocation Failed',
    chainId,
    pendingDescription: 'Moving liquidity between markets via the Public Allocator...',
    successDescription: 'Liquidity has been successfully reallocated',
    onSuccess,
  });

  /**
   * Execute a reallocation from source markets to the target market.
   *
   * @param withdrawals - Array of { marketParams, amount } sorted by market ID ascending
   * @param supplyMarketParams - The target market to supply to
   */
  const reallocate = async (
    withdrawals: {
      marketParams: MarketParams;
      amount: bigint;
    }[],
    supplyMarketParams: MarketParams,
  ) => {
    if (!allocatorAddress || !vaultAddress) {
      throw new Error('Public Allocator: missing allocator address or vault address');
    }

    await switchChainAsync({ chainId });

    await sendTransactionAsync({
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

  /**
   * Pull liquidity from source markets into the target market.
   * Handles sorting withdrawals by market ID (required by the contract).
   *
   * @param sourceMarkets - Array of source markets with their params, amounts, and sort keys
   * @param targetMarketParams - The target market to supply pulled liquidity to
   */
  const pullLiquidity = async (
    sourceMarkets: {
      marketParams: MarketParams;
      amount: bigint;
      sortKey: string; // uniqueKey for sorting
    }[],
    targetMarketParams: MarketParams,
  ) => {
    // Contract requires withdrawals sorted by market ID (bytes32 ascending)
    const sorted = [...sourceMarkets].sort((a, b) =>
      a.sortKey.toLowerCase() < b.sortKey.toLowerCase() ? -1 : a.sortKey.toLowerCase() > b.sortKey.toLowerCase() ? 1 : 0,
    );

    const withdrawals = sorted.map(({ marketParams, amount }) => ({
      marketParams,
      amount,
    }));

    await reallocate(withdrawals, targetMarketParams);
  };

  return {
    isSupported,
    reallocate,
    pullLiquidity,
    isConfirming,
  };
}
