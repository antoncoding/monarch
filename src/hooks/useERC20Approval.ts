import { useCallback, useMemo } from 'react';
import { Address, encodeFunctionData, erc20Abi } from 'viem';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { useTransactionWithToast } from './useTransactionWithToast';

export function useERC20Approval({
  token,
  spender,
  amount,
  tokenSymbol,
  chainId,
}: {
  token: Address;
  spender: Address;
  amount: bigint;
  tokenSymbol: string;
  chainId?: number;
}) {
  const { address: account } = useAccount();
  const currentChain = useChainId();

  const chainIdToUse = chainId ?? currentChain;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account as Address, spender],
    query: {
      enabled: !!account,
    },
    chainId: chainIdToUse,
  });

  const isApproved = useMemo(() => {
    if (!allowance || !amount) return false;
    return allowance >= amount;
  }, [allowance, amount]);

  const { isConfirming: isApproving, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'approve',
    pendingText: `Approving ${tokenSymbol}`,
    successText: `${tokenSymbol} Approved`,
    errorText: 'Failed to approve',
    chainId: chainIdToUse,
    pendingDescription: `Approving ${tokenSymbol} for spender ${spender.slice(2, 8)}...`,
    successDescription: `Successfully approved ${tokenSymbol} for spender ${spender.slice(2, 8)}`,
  });

  const approve = useCallback(async () => {
    if (!account || !amount) return;

    await sendTransactionAsync({
      account,
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
      }),
    });

    await refetchAllowance();
  }, [account, amount, sendTransactionAsync, token, spender, refetchAllowance]);

  return {
    isApproved,
    approve,
    isApproving,
  };
}
