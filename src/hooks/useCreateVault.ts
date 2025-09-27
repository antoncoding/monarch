import { useCallback, useState } from 'react';
import { Address, encodeFunctionData, keccak256, toBytes } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { abi as vaultV2Abi } from '@/abis/vaultv2';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';

// TODO: Move to contracts file
const VAULT_V2_FACTORY_ADDRESS: Record<number, Address> = {
  1: '0x0000000000000000000000000000000000000000',
  8453: '0x0000000000000000000000000000000000000000',
  137: '0x0000000000000000000000000000000000000000',
  42161: '0x0000000000000000000000000000000000000000',
};

export type CreateVaultStepType = 'deploy' | 'deploying';

export type UseCreateVaultReturn = {
  // State
  currentStep: CreateVaultStepType;

  // Transaction state
  isDeploying: boolean;

  // Actions
  createVault: (asset: Address, salt?: string) => Promise<Address | null>;
  calculateVaultAddress: (owner: Address, asset: Address, salt?: string) => Address | undefined;
};

export function useCreateVault(chainId: number, onSuccess?: (vaultAddress: Address) => void): UseCreateVaultReturn {
  const [currentStep, setCurrentStep] = useState<CreateVaultStepType>('deploy');

  const { address: account } = useAccount();
  const toast = useStyledToast();

  // Transaction handler
  const { isConfirming: isDeploying, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'createVault',
    pendingText: 'Deploying Vault',
    successText: 'Vault Deployed',
    errorText: 'Failed to deploy vault',
    chainId,
    pendingDescription: 'Deploying your autovault contract...',
    successDescription: 'Your autovault has been successfully deployed',
    onSuccess: () => {
      setCurrentStep('deploy');
    },
  });

  // Calculate vault address before deployment
  const calculateVaultAddress = useCallback((owner: Address, asset: Address, salt?: string): Address | undefined => {
    try {
      const saltBytes = salt ? keccak256(toBytes(salt)) : keccak256(toBytes('default'));

      // This should call the vaultV2 view function to get the predicted address
      // For now, we'll return undefined and let the actual contract call handle it
      return undefined;
    } catch (error) {
      console.error('Error calculating vault address:', error);
      return undefined;
    }
  }, []);

  // Get predicted vault address using contract call
  const { data: predictedVaultAddress } = useReadContract({
    address: VAULT_V2_FACTORY_ADDRESS[chainId] as Address,
    abi: vaultV2Abi,
    functionName: 'vaultV2',
    args: account && [account, '0x0000000000000000000000000000000000000000' as Address, keccak256(toBytes('default'))],
    chainId,
    query: {
      enabled: !!account,
    },
  }) as { data: Address | undefined };

  // Execute vault creation
  const createVault = useCallback(async (asset: Address, salt?: string): Promise<Address | null> => {
    if (!account) {
      toast.error('No Account', 'Please connect your wallet to deploy a vault');
      return null;
    }

    try {
      setCurrentStep('deploying');

      const saltBytes = salt ? keccak256(toBytes(salt)) : keccak256(toBytes('default'));

      const txData = encodeFunctionData({
        abi: vaultV2Abi,
        functionName: 'createVaultV2',
        args: [account, asset, saltBytes],
      });

      const hash = await sendTransactionAsync({
        account,
        to: VAULT_V2_FACTORY_ADDRESS[chainId] as Address,
        data: txData,
      });

      // Get the vault address from the transaction receipt
      // For now, we'll use the predicted address
      const vaultAddress = predictedVaultAddress;

      if (vaultAddress && onSuccess) {
        onSuccess(vaultAddress);
      }

      return vaultAddress ?? null;
    } catch (error: unknown) {
      setCurrentStep('deploy');
      console.error('Error creating vault:', error);

      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction Rejected', 'Vault deployment was rejected by user');
        } else {
          toast.error('Deployment Error', 'Failed to deploy vault');
        }
      } else {
        toast.error('Deployment Error', 'An unexpected error occurred');
      }

      return null;
    }
  }, [
    account,
    chainId,
    predictedVaultAddress,
    sendTransactionAsync,
    toast,
    onSuccess,
  ]);

  return {
    currentStep,
    isDeploying,
    createVault,
    calculateVaultAddress,
  };
}