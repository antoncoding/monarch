import { useCallback, useState } from 'react';
import { Address, encodeFunctionData, keccak256, toBytes } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { abi as vaultFactoryAbi } from '@/abis/vaultv2factory';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { getAgentConfig } from '@/utils/networks';

export type CreateVaultStepType = 'deploy' | 'deploying';

export type UseCreateVaultReturn = {
  // State
  currentStep: CreateVaultStepType;

  // Transaction state
  isDeploying: boolean;

  // Actions
  createVault: (asset: Address, salt?: string) => Promise<Address | null>;
};

export function useCreateVault(chainId: number, onSuccess?: (vaultAddress: Address) => void): UseCreateVaultReturn {
  const [currentStep, setCurrentStep] = useState<CreateVaultStepType>('deploy');

  const { address: account } = useAccount();
  const toast = useStyledToast();

  // Get agent config for this network
  const agentConfig = getAgentConfig(chainId);

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

  // Get predicted vault address using contract call
  const { data: predictedVaultAddress } = useReadContract({
    address: agentConfig?.factoryAddress,
    abi: vaultFactoryAbi,
    functionName: 'vaultV2',
    args: account && [account, '0x0000000000000000000000000000000000000000' as Address, keccak256(toBytes('default'))],
    chainId,
    query: {
      enabled: !!account && !!agentConfig?.factoryAddress,
    },
  }) as { data: Address | undefined };

  // Execute vault creation
  const createVault = useCallback(async (asset: Address, salt?: string): Promise<Address | null> => {
    if (!account) {
      toast.error('No Account', 'Please connect your wallet to deploy a vault');
      return null;
    }

    if (!agentConfig?.factoryAddress) {
      toast.error('Network Not Supported', 'Vault deployment is not available on this network');
      return null;
    }

    try {
      setCurrentStep('deploying');

      const saltBytes = salt ? keccak256(toBytes(salt)) : keccak256(toBytes('default'));

      const txData = encodeFunctionData({
        abi: vaultFactoryAbi,
        functionName: 'createVaultV2',
        args: [account, asset, saltBytes],
      });

      await sendTransactionAsync({
        account,
        to: agentConfig.factoryAddress,
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
    agentConfig,
    predictedVaultAddress,
    sendTransactionAsync,
    toast,
    onSuccess,
  ]);

  return {
    currentStep,
    isDeploying,
    createVault,
  };
}