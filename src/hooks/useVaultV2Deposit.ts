import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useAccount, useBalance } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { usePermit2 } from '@/hooks/usePermit2';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { GAS_COSTS, GAS_MULTIPLIER } from 'app/markets/components/constants';

export type VaultDepositStepType = 'approve' | 'signing' | 'depositing';

export type UseVaultV2DepositReturn = {
  // State
  depositAmount: bigint;
  setDepositAmount: Dispatch<SetStateAction<bigint>>;
  inputError: string | null;
  setInputError: Dispatch<SetStateAction<string | null>>;
  showProcessModal: boolean;
  setShowProcessModal: Dispatch<SetStateAction<boolean>>;
  currentStep: VaultDepositStepType;

  // Balance data
  tokenBalance: bigint | undefined;

  // Transaction state
  isApproved: boolean;
  permit2Authorized: boolean;
  isLoadingPermit2: boolean;
  depositPending: boolean;

  // Actions
  approveAndDeposit: () => Promise<void>;
  signAndDeposit: () => Promise<void>;
};

type UseVaultV2DepositParams = {
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  chainId: number;
  vaultName: string;
  onSuccess?: () => void;
};

export function useVaultV2Deposit({
  vaultAddress,
  assetAddress,
  assetSymbol,
  assetDecimals,
  chainId,
  vaultName,
  onSuccess,
}: UseVaultV2DepositParams): UseVaultV2DepositReturn {
  // State
  const [depositAmount, setDepositAmount] = useState<bigint>(BigInt(0));
  const [inputError, setInputError] = useState<string | null>(null);
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<VaultDepositStepType>('approve');
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  const { address: account } = useAccount();
  const toast = useStyledToast();

  // Get token balance
  const { data: tokenBalance } = useBalance({
    token: assetAddress,
    address: account,
    chainId,
  });

  // Handle Permit2 authorization - authorize bundler to use Permit2 on behalf of user
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as Address,
    spender: getBundlerV2(chainId),
    token: assetAddress,
    refetchInterval: 10000,
    chainId,
    tokenSymbol: assetSymbol,
    amount: depositAmount,
  });

  // Handle ERC20 approval - approve bundler for standard flow
  const { isApproved, approve } = useERC20Approval({
    token: assetAddress,
    spender: getBundlerV2(chainId),
    amount: depositAmount,
    tokenSymbol: assetSymbol,
  });

  // Transaction handler
  const { isConfirming: depositPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'vault-deposit',
    pendingText: `Depositing ${formatBalance(depositAmount, assetDecimals)} ${assetSymbol}`,
    successText: `${assetSymbol} Deposited to Vault`,
    errorText: 'Failed to deposit',
    chainId,
    pendingDescription: `Depositing to ${vaultName}...`,
    successDescription: `Successfully deposited to ${vaultName}`,
    onSuccess,
  });

  // Execute deposit transaction
  const executeDepositTransaction = useCallback(async () => {
    try {
      const txs: `0x${string}`[] = [];
      let gas = undefined;

      if (usePermit2Setting) {
        // Permit2 flow: Sign permit and use bundler to deposit
        const { sigs, permitSingle } = await signForBundlers();

        const tx1 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'approve2',
          args: [permitSingle, sigs, false],
        });

        // transferFrom with permit2
        const tx2 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'transferFrom2',
          args: [assetAddress, depositAmount],
        });

        txs.push(tx1, tx2);
      } else {
        // Standard ERC20 flow: Transfer tokens to bundler first
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20TransferFrom',
            args: [assetAddress, depositAmount],
          }),
        );

        // Standard Flow: add gas
        gas = GAS_COSTS.SINGLE_SUPPLY; // Using same gas estimate as supply
      }

      setCurrentStep('depositing');

      const minShares = BigInt(1);
      const erc4626DepositTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'erc4626Deposit',
        args: [vaultAddress, depositAmount, minShares, account as Address],
      });

      txs.push(erc4626DepositTx);

      // add timeout here to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await sendTransactionAsync({
        account,
        to: getBundlerV2(chainId),
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
        value: 0n,

        // Only add gas for standard approval flow -> skip gas estimation
        gas: gas ? BigInt(gas * GAS_MULTIPLIER) : undefined,
      });

      setShowProcessModal(false);

      return true;
    } catch (_error: unknown) {
      setShowProcessModal(false);
      toast.error('Deposit Failed', 'Deposit to vault failed or cancelled');
      return false;
    }
  }, [account, assetAddress, vaultAddress, depositAmount, sendTransactionAsync, signForBundlers, usePermit2Setting, toast, chainId]);

  // Approve and deposit handler
  const approveAndDeposit = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('approve');

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          if (!permit2Authorized) {
            await authorizePermit2();
          }

          setCurrentStep('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));

          await executeDepositTransaction();
        } catch (error: unknown) {
          console.error('Error in Permit2 flow:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Transaction rejected', 'Transaction rejected by user');
            } else {
              toast.error('Error', 'Failed to process Permit2 transaction');
            }
          } else {
            toast.error('Error', 'An unexpected error occurred');
          }
          throw error;
        }
        return;
      }

      // Standard ERC20 flow
      if (!isApproved) {
        try {
          await approve();
          setCurrentStep('depositing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: unknown) {
          console.error('Error in approval:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Transaction rejected', 'Approval rejected by user');
            } else {
              toast.error('Transaction Error', 'Failed to approve token');
            }
          } else {
            toast.error('Transaction Error', 'An unexpected error occurred during approval');
          }
          throw error;
        }
      } else {
        setCurrentStep('depositing');
      }

      await executeDepositTransaction();
    } catch (error: unknown) {
      console.error('Error in approveAndDeposit:', error);
      setShowProcessModal(false);
    }
  }, [account, authorizePermit2, executeDepositTransaction, usePermit2Setting, isApproved, approve, toast]);

  // Sign and deposit handler (for when already authorized)
  const signAndDeposit = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('signing');
      await executeDepositTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndDeposit:', error);
      setShowProcessModal(false);
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Transaction Error', 'Failed to process transaction');
        }
      } else {
        toast.error('Transaction Error', 'An unexpected error occurred');
      }
    }
  }, [account, executeDepositTransaction, toast]);

  return {
    // State
    depositAmount,
    setDepositAmount,
    inputError,
    setInputError,
    showProcessModal,
    setShowProcessModal,
    currentStep,

    // Balance data
    tokenBalance: tokenBalance?.value,

    // Transaction state
    isApproved,
    permit2Authorized,
    isLoadingPermit2,
    depositPending,

    // Actions
    approveAndDeposit,
    signAndDeposit,
  };
}
