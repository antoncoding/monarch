import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { type Address, encodeFunctionData, erc20Abi } from 'viem';
import { useConnection, useReadContract } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { usePermit2 } from '@/hooks/usePermit2';
import { useAppSettings } from '@/stores/useAppSettings';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { GAS_COSTS, GAS_MULTIPLIER } from '@/features/markets/components/constants';

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
  const [currentStep, setCurrentStep] = useState<VaultDepositStepType>('approve');
  const { usePermit2: usePermit2Setting } = useAppSettings();

  // Transaction tracking
  const { start, update, complete, fail, showModal, setModalOpen } = useTransactionTracking('deposit');

  const { address: account } = useConnection();
  const toast = useStyledToast();

  // Get token balance
  const { data: tokenBalance } = useReadContract({
    address: assetAddress,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId,
    query: { enabled: !!account },
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
    refetchInterval: 10_000,
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

  // Helper to generate steps based on flow type
  const getStepsForFlow = useCallback(
    (isPermit2: boolean) => {
      if (isPermit2) {
        return [
          {
            id: 'approve',
            title: 'Authorize Permit2',
            description: "This one-time approval makes sure you don't need to send approval tx again in the future.",
          },
          { id: 'signing', title: 'Sign message in wallet', description: 'Sign a Permit2 signature to authorize the deposit' },
          { id: 'depositing', title: 'Confirm Deposit', description: 'Confirm transaction in wallet to complete the deposit' },
        ];
      }
      return [
        { id: 'approve', title: 'Approve Token', description: `Approve ${assetSymbol} for spending` },
        { id: 'depositing', title: 'Confirm Deposit', description: 'Confirm transaction in wallet to complete the deposit' },
      ];
    },
    [assetSymbol],
  );

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
      update('depositing');

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

      complete();
      return true;
    } catch (_error: unknown) {
      fail();
      toast.error('Deposit Failed', 'Deposit to vault failed or cancelled');
      return false;
    }
  }, [
    account,
    assetAddress,
    vaultAddress,
    depositAmount,
    sendTransactionAsync,
    signForBundlers,
    usePermit2Setting,
    toast,
    chainId,
    update,
    complete,
    fail,
  ]);

  // Approve and deposit handler
  const approveAndDeposit = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setCurrentStep('approve');
      start(getStepsForFlow(usePermit2Setting), { tokenSymbol: assetSymbol, amount: depositAmount, vaultName }, 'approve');

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          if (!permit2Authorized) {
            await authorizePermit2();
          }

          setCurrentStep('signing');
          update('signing');

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
      if (isApproved) {
        setCurrentStep('depositing');
        update('depositing');
      } else {
        try {
          await approve();
          setCurrentStep('depositing');
          update('depositing');

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
      }

      await executeDepositTransaction();
    } catch (error: unknown) {
      console.error('Error in approveAndDeposit:', error);
      fail();
    }
  }, [
    account,
    authorizePermit2,
    executeDepositTransaction,
    usePermit2Setting,
    isApproved,
    approve,
    toast,
    permit2Authorized,
    start,
    update,
    fail,
    getStepsForFlow,
    assetSymbol,
    depositAmount,
    vaultName,
  ]);

  // Sign and deposit handler (for when already authorized)
  const signAndDeposit = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setCurrentStep('signing');
      start(getStepsForFlow(usePermit2Setting), { tokenSymbol: assetSymbol, amount: depositAmount, vaultName }, 'signing');

      await executeDepositTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndDeposit:', error);
      fail();
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
  }, [account, executeDepositTransaction, toast, start, fail, getStepsForFlow, usePermit2Setting, assetSymbol, depositAmount, vaultName]);

  return {
    // State
    depositAmount,
    setDepositAmount,
    inputError,
    setInputError,
    showProcessModal: showModal,
    setShowProcessModal: setModalOpen,
    currentStep,

    // Balance data
    tokenBalance,

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
