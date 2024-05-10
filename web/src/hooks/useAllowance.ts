import { useCallback, useEffect, useState } from 'react';
import { Address } from 'abitype';
import { toast } from 'react-hot-toast';
import { erc20Abi, maxUint256 } from 'viem';
import { Chain } from 'viem/chains';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';

type Props = {
  token: Address;
  chainId?: Chain['id'];
  user: Address | undefined;
  spender?: Address;
  refetchInterval?: number;
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
  spender = '0x000000000022d473030f116ddee9f6b43ac78ba3', // default to Permit2
  chainId = 1,
  token,
  refetchInterval = 10000,
}: Props) {
  const [isLoadingAllowance, setIsLoadingAllowance] = useState<boolean>(false);
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));

  const [pendingToastId, setPendingToastId] = useState<string | undefined>();

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

  const {
    writeContract,
    data: dataHash,
    error: checkInError,
    isPending: approvePending,
    isSuccess: approveSuccess,
  } = useWriteContract();

  const approveInfinite = useCallback(async () => {
    if (!user || !spender || !token) throw new Error('User, spender, or token not provided');

    writeContract({
      account: user,
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, maxUint256],
    });
  }, [user, spender, token, writeContract]);

  useEffect(() => {
    if (approvePending) {
      const pendingId = toast.loading('Please sign in wallet');
      setPendingToastId(pendingId);
    }
  }, [approvePending]);

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Successfully Approved');
      if (pendingToastId) {
        toast.dismiss(pendingToastId);
      }
    }
    if (checkInError) {
      toast.error('Tx Error');
      if (pendingToastId) {
        toast.dismiss(pendingToastId);
      }
    }
  }, [approveSuccess, checkInError, pendingToastId, dataHash]);

  return { allowance, isLoadingAllowance, approveInfinite, approvePending };
}