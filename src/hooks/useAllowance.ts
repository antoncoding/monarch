import { useCallback, useEffect, useState } from 'react';
import { Address } from 'abitype';
import { encodeFunctionData, erc20Abi, maxUint256 } from 'viem';
import { Chain } from 'viem/chains';
import { useAccount, usePublicClient } from 'wagmi';
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
  const [isLoadingAllowance, setIsLoadingAllowance] = useState<boolean>(false);
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));

  const { chain } = useAccount();
  const chainIdFromArgumentOrConnectedWallet = chainId ?? chain?.id;
  const publicClient = usePublicClient({ chainId: chainIdFromArgumentOrConnectedWallet });

  useEffect(() => {
    async function fetchApproval() {
      if (!publicClient || !token || !user) return;

      setIsLoadingAllowance(true);

      try {
        const approval = await publicClient.readContract({
          abi: erc20Abi,
          functionName: 'allowance',
          address: token,
          args: [user, spender],
        });
        setAllowance(approval);
      } catch (error) {
        console.error('useAllowance Error', error);
      } finally {
        setIsLoadingAllowance(false);
      }
    }

    void fetchApproval();

    // use set interval to call fetchApproval every refetchInterval
    const interval = setInterval(() => void fetchApproval(), refetchInterval);

    return () => clearInterval(interval);
  }, [user, spender, chainId, token, publicClient, refetchInterval]);

  const { sendTransaction, isConfirming: approvePending } = useTransactionWithToast(
    'approve',
    `Pending approval of ${tokenSymbol ?? 'your token'}`,
    `Succesfully approved`,
    'Approve Error',
    chainId,
  );

  const approveInfinite = useCallback(async () => {
    if (!user || !spender || !token) throw new Error('User, spender, or token not provided');

    // some weird bug with writeContract, update to use useSendTransaction
    sendTransaction({
      account: user,
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, maxUint256],
      }),
      chainId: chainIdFromArgumentOrConnectedWallet,
    });
  }, [user, spender, token, sendTransaction, chainIdFromArgumentOrConnectedWallet]);

  return { allowance, isLoadingAllowance, approveInfinite, approvePending };
}
