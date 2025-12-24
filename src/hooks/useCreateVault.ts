import { useCallback, useState } from 'react';
import { type Address, encodeFunctionData, keccak256, toBytes } from 'viem';
import { useConnection } from 'wagmi';
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
  createVault: (asset: Address, salt?: string) => Promise<string | undefined>;
};

export function useCreateVault(chainId: number): UseCreateVaultReturn {
  const [currentStep, setCurrentStep] = useState<CreateVaultStepType>('deploy');

  const { address: account } = useConnection();
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
    async (asset: Address, salt?: string): Promise<string | undefined> => {
      if (!account) {
        toast.error('No Account', 'Please connect your wallet to deploy a vault');
        return undefined;
      }

      if (!agentConfig?.v2FactoryAddress) {
        toast.error('Network Not Supported', 'Vault deployment is not available on this network');
        return undefined;
      }

      try {
        setCurrentStep('deploying');

        const saltBytes = salt ? keccak256(toBytes(salt)) : keccak256(toBytes('default'));

        const txData = encodeFunctionData({
          abi: vaultFactoryAbi,
          functionName: 'createVaultV2',
          args: [account, asset, saltBytes],
        });

        const txHash = await sendTransactionAsync({
          account,
          to: agentConfig.v2FactoryAddress,
          data: txData,
        });

        setCurrentStep('deploy');
        return txHash;
      } catch (error: unknown) {
        setCurrentStep('deploy');

        if (error instanceof Error) {
          if (error.message.includes('User rejected') || error.message.includes('rejected')) {
            toast.error('Transaction Rejected', 'Vault deployment was rejected by user');
          } else {
            toast.error('Deployment Error', 'Failed to deploy vault');
          }
        } else {
          toast.error('Deployment Error', 'An unexpected error occurred');
        }
        return undefined;
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
