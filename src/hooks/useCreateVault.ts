import { useCallback, useState } from 'react';
import { type Address, encodeFunctionData, keccak256, toBytes } from 'viem';
import { useAccount } from 'wagmi';
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
  createVault: (asset: Address, salt?: string) => Promise<void>;
};

export function useCreateVault(chainId: number): UseCreateVaultReturn {
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

  // Execute vault creation
  const createVault = useCallback(
    async (asset: Address, salt?: string): Promise<void> => {
      if (!account) {
        toast.error('No Account', 'Please connect your wallet to deploy a vault');
        return;
      }

      if (!agentConfig?.v2FactoryAddress) {
        toast.error('Network Not Supported', 'Vault deployment is not available on this network');
        return;
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
          to: agentConfig.v2FactoryAddress,
          data: txData,
        });

        setCurrentStep('deploy');
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
      }
    },
    [account, agentConfig, sendTransactionAsync, toast],
  );

  return {
    currentStep,
    isDeploying,
    createVault,
  };
}
