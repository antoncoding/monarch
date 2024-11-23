import { useCallback } from 'react';
import { Address } from 'abitype';
import { encodeFunctionData, erc20Abi, maxUint256, zeroAddress } from 'viem';
import { Chain } from 'viem/chains';
import { useAccount, useReadContract } from 'wagmi';
import { useTransactionWithToast } from './useTransactionWithToast';

type Props = {
  token: Address;
  chainId?: Chain['id'];
  user: Address | undefined;
  spender: Address;
  refetchInterval?: number;
  tokenSymbol?: string;
};

/**
 * @param enabled Conditionally run the hook query
 * @param address Address for the contract
 * @param chainId Chain ID for the contract. If not provided, the chain ID from the connected wallet will be used.
 * @param refetchInterval Interval in milliseconds to refetch the contract data
 * @returns JsonMetadata
 */
export function useAllowance({
  user,
  spender,
  chainId = 1,
  token,
  refetchInterval = 10000,
  tokenSymbol,
}: Props) {
  const { chain } = useAccount();
  const chainIdFromArgumentOrConnectedWallet = chainId ?? chain?.id;

  const { data } = useReadContract({
    abi: erc20Abi,
    functionName: 'allowance',
    address: token,
    args: [user ?? zeroAddress, spender],
    query: {
      enabled: !!user && !!spender && !!token,
      refetchInterval,
    },
    chainId,
  });

  const { sendTransactionAsync, isConfirming: approvePending } = useTransactionWithToast({
    toastId: 'approve',
    pendingText: `Pending approval of ${tokenSymbol ?? 'your token'}`,
    successText: 'Successfully approved',
    errorText: 'Approve Error',
    chainId,
    pendingDescription: `Approving ${tokenSymbol ?? 'token'} for ${spender.slice(0, 6)}...`,
    successDescription: `Successfully approved ${tokenSymbol ?? 'token'} for ${spender.slice(
      0,
      6,
    )}...`,
  });

  const approveInfinite = useCallback(async () => {
    if (!user || !spender || !token) throw new Error('User, spender, or token not provided');
    // some weird bug with writeContract, update to use useSendTransaction
    await sendTransactionAsync({
      account: user,
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, maxUint256],
      }),
      chainId: chainIdFromArgumentOrConnectedWallet,
    });
  }, [user, spender, token, sendTransactionAsync, chainIdFromArgumentOrConnectedWallet]);

  const allowance = data ? data : BigInt(0);

  const isLoadingAllowance = data === undefined;

  return { allowance, isLoadingAllowance, approveInfinite, approvePending };
}
