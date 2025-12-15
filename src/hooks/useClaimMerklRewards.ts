import { useState, useCallback } from 'react';
import { useConnection, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from 'wagmi';
import type { Address } from 'viem';
import { merklDistributorAbi, MERKL_DISTRIBUTOR_ADDRESS } from '@/abis/merkl-distributor';
import type { MerklRewardWithProofs } from './useRewards';

type ClaimStatus = 'idle' | 'preparing' | 'switching' | 'pending' | 'success' | 'error';

type ClaimResult = {
  status: ClaimStatus;
  txHash?: Address;
  error?: Error;
};

export function useClaimMerklRewards() {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle');
  const [txHash, setTxHash] = useState<Address | undefined>(undefined);

  const { mutateAsync: writeContractAsync, error: writeError, isPending: isWritePending } = useWriteContract();
  const { mutateAsync: switchChainAsync } = useSwitchChain();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const claimRewards = useCallback(
    async (rewards: MerklRewardWithProofs[]): Promise<ClaimResult> => {

      console.log('test', rewards)

      if (!address) {
        return {
          status: 'error',
          error: new Error('Wallet not connected'),
        };
      }

      if (rewards.length === 0) {
        return {
          status: 'error',
          error: new Error('No rewards provided'),
        };
      }

      // Get the target chain ID from the first reward (all rewards passed should be for the same chain)
      const targetChainId = rewards[0].chainId;

      // Filter rewards for the target chain and with claimable amounts
      const claimableRewards = rewards.filter((reward) => {
        const claimable = BigInt(reward.amount) - BigInt(reward.claimed);
        return reward.chainId === targetChainId && claimable > 0n && reward.proofs.length > 0;
      });

      if (claimableRewards.length === 0) {
        return {
          status: 'error',
          error: new Error('No claimable rewards for this chain'),
        };
      }

      try {
        setClaimStatus('preparing');

        // Check if we need to switch chains
        if (currentChainId !== targetChainId) {
          setClaimStatus('switching');
          try {
            await switchChainAsync({ chainId: targetChainId });
          } catch (switchError) {
            // User rejected chain switch or other error
            setClaimStatus('error');
            return {
              status: 'error',
              error: switchError instanceof Error ? switchError : new Error('Chain switch failed'),
            };
          }
        }

        // Prepare claim data
        const users: Address[] = [];
        const tokens: Address[] = [];
        const amounts: bigint[] = [];
        const proofs: `0x${string}`[][] = [];

        for (const reward of claimableRewards) {
          users.push(address);
          tokens.push(reward.tokenAddress);
          amounts.push(BigInt(reward.amount));
          proofs.push(reward.proofs as `0x${string}`[]);
        }

        setClaimStatus('pending');

        // Execute claim transaction - same distributor address on all chains
        const hash = await writeContractAsync({
          address: MERKL_DISTRIBUTOR_ADDRESS,
          abi: merklDistributorAbi,
          functionName: 'claim',
          args: [users, tokens, amounts, proofs],
        });

        // Store hash for transaction receipt tracking
        setTxHash(hash);
        setClaimStatus('success');

        return {
          status: 'success',
          txHash: hash,
        };
      } catch (err) {
        setClaimStatus('error');
        return {
          status: 'error',
          error: new Error("Claiming failed or canceled, please try again later")
        };
      }
    },
    [address, currentChainId, switchChainAsync, writeContractAsync],
  );

  const claimSingleReward = useCallback(
    async (reward: MerklRewardWithProofs): Promise<ClaimResult> => {
      return claimRewards([reward]);
    },
    [claimRewards],
  );

  const reset = useCallback(() => {
    setClaimStatus('idle');
  }, []);

  return {
    claimRewards,
    claimSingleReward,
    claimStatus,
    isWritePending,
    isConfirming,
    isConfirmed,
    txHash,
    error: writeError,
    reset,
  };
}
