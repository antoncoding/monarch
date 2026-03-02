import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Address, encodeFunctionData, zeroAddress } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { GAS_MULTIPLIER_DENOMINATOR, GAS_MULTIPLIER_NUMERATOR } from '@/features/markets/components/constants';
import { useAppSettings } from '@/stores/useAppSettings';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { useBundlerAuthorizationStep } from './useBundlerAuthorizationStep';
import { useERC20Approval } from './useERC20Approval';
import { usePermit2 } from './usePermit2';
import { useStyledToast } from './useStyledToast';
import { useTransactionTracking } from './useTransactionTracking';
import { useTransactionWithToast } from './useTransactionWithToast';

export type RebalanceExecutionStepType =
  | 'idle'
  | 'approve_permit2'
  | 'authorize_bundler_sig'
  | 'sign_permit'
  | 'authorize_bundler_tx'
  | 'approve_token'
  | 'execute';

type ExecuteRebalanceBundleInput = {
  metadata: {
    title: string;
    description: string;
    tokenSymbol: string;
    summaryItems?: TransactionSummaryItem[];
  };
  withdrawTxs: `0x${string}`[];
  supplyTxs: `0x${string}`[];
  trailingTxs?: `0x${string}`[];
  gasEstimate?: bigint;
  transferAmount?: bigint;
  requiresAssetTransfer?: boolean;
  onSubmitted?: () => void;
};

type UseRebalanceExecutionParams = {
  chainId: number;
  loanAssetAddress: Address;
  loanAssetSymbol: string;
  requiredAmount: bigint;
  trackingType: string;
  toastId: string;
  pendingText: string;
  successText: string;
  errorText: string;
  onSuccess?: () => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isUserRejected(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  if (err.code === 4001 || err.code === 'ACTION_REJECTED') return true;

  const message = typeof err.message === 'string' ? err.message : '';
  if (/user rejected|user denied|request has been rejected/i.test(message)) return true;

  const nested = (err.data as Record<string, unknown> | undefined)?.originalError as Record<string, unknown> | undefined;
  if (nested?.code === 4001 || nested?.code === 'ACTION_REJECTED') return true;

  const cause = err.cause as Record<string, unknown> | undefined;
  if (cause?.code === 4001 || cause?.code === 'ACTION_REJECTED') return true;

  return false;
}

const getStepsForFlow = (isPermit2: boolean, loanAssetSymbol: string, requiresAssetTransfer: boolean) => {
  if (isPermit2 && requiresAssetTransfer) {
    return [
      { id: 'approve_permit2', title: 'Authorize Permit2', description: 'One-time approval for future transactions.' },
      { id: 'authorize_bundler_sig', title: 'Authorize Morpho Bundler', description: 'Sign a message to authorize the Morpho bundler.' },
      { id: 'sign_permit', title: 'Sign Token Permit', description: 'Sign a Permit2 signature to authorize token transfer.' },
      { id: 'execute', title: 'Confirm Rebalance', description: 'Confirm transaction in wallet to execute rebalance.' },
    ];
  }

  if (!isPermit2 && requiresAssetTransfer) {
    return [
      {
        id: 'authorize_bundler_tx',
        title: 'Authorize Morpho Bundler (Transaction)',
        description: 'Submit a transaction to authorize the Morpho bundler.',
      },
      { id: 'approve_token', title: `Approve ${loanAssetSymbol}`, description: `Approve ${loanAssetSymbol} for spending.` },
      { id: 'execute', title: 'Confirm Rebalance', description: 'Confirm transaction in wallet to execute rebalance.' },
    ];
  }

  return isPermit2
    ? [
        {
          id: 'authorize_bundler_sig',
          title: 'Authorize Morpho Bundler',
          description: 'Sign a message to authorize the Morpho bundler.',
        },
        { id: 'execute', title: 'Confirm Rebalance', description: 'Confirm transaction in wallet to execute rebalance.' },
      ]
    : [
        {
          id: 'authorize_bundler_tx',
          title: 'Authorize Morpho Bundler (Transaction)',
          description: 'Submit a transaction to authorize the Morpho bundler.',
        },
        { id: 'execute', title: 'Confirm Rebalance', description: 'Confirm transaction in wallet to execute rebalance.' },
      ];
};

export function useRebalanceExecution({
  chainId,
  loanAssetAddress,
  loanAssetSymbol,
  requiredAmount,
  trackingType,
  toastId,
  pendingText,
  successText,
  errorText,
  onSuccess,
}: UseRebalanceExecutionParams) {
  const [isProcessing, setIsProcessing] = useState(false);

  const tracking = useTransactionTracking(trackingType);
  const toast = useStyledToast();
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const { address: account } = useConnection();

  const bundlerAddress = getBundlerV2(chainId as SupportedNetworks);
  const hasBundler = bundlerAddress !== zeroAddress;

  const { isBundlerAuthorized, isAuthorizingBundler, ensureBundlerAuthorization, refetchIsBundlerAuthorized } = useBundlerAuthorizationStep(
    {
      chainId,
      bundlerAddress: bundlerAddress as Address,
    },
  );

  const {
    authorizePermit2,
    permit2Authorized,
    signForBundlers,
    isLoading: isLoadingPermit2,
  } = usePermit2({
    user: account,
    spender: bundlerAddress,
    token: loanAssetAddress,
    refetchInterval: 10_000,
    chainId,
    tokenSymbol: loanAssetSymbol,
    amount: requiredAmount,
  });

  const permit2AuthorizedRef = useRef(permit2Authorized);
  const isLoadingPermit2Ref = useRef(isLoadingPermit2);

  useEffect(() => {
    permit2AuthorizedRef.current = permit2Authorized;
  }, [permit2Authorized]);

  useEffect(() => {
    isLoadingPermit2Ref.current = isLoadingPermit2;
  }, [isLoadingPermit2]);

  const {
    isApproved: isTokenApproved,
    approve: approveToken,
    isApproving: isTokenApproving,
  } = useERC20Approval({
    token: loanAssetAddress,
    spender: bundlerAddress,
    amount: requiredAmount,
    tokenSymbol: loanAssetSymbol,
    chainId,
  });

  const handleTxConfirmed = useCallback(() => {
    void refetchIsBundlerAuthorized();
    onSuccess?.();
  }, [refetchIsBundlerAuthorized, onSuccess]);

  const { sendTransactionAsync, isConfirming: isExecuting } = useTransactionWithToast({
    toastId,
    pendingText,
    successText,
    errorText,
    chainId,
    onSuccess: handleTxConfirmed,
  });

  const waitForPermit2State = useCallback(async () => {
    const start = Date.now();
    const timeoutMs = 15_000;

    while (isLoadingPermit2Ref.current) {
      if (Date.now() - start >= timeoutMs) {
        throw new Error('Permit2 allowance check timed out.');
      }
      await sleep(100);
    }
  }, []);

  const executeBundle = useCallback(
    async ({
      metadata,
      withdrawTxs,
      supplyTxs,
      trailingTxs,
      gasEstimate,
      transferAmount,
      requiresAssetTransfer,
      onSubmitted,
    }: ExecuteRebalanceBundleInput): Promise<boolean> => {
      const amount = transferAmount ?? requiredAmount;
      const shouldTransfer = requiresAssetTransfer ?? true;
      const hasExecutableTxs = withdrawTxs.length > 0 || supplyTxs.length > 0 || (trailingTxs?.length ?? 0) > 0;

      if (!account) {
        return false;
      }

      if (!hasExecutableTxs) {
        toast.info('Nothing to rebalance', 'No moves to execute.');
        return false;
      }

      if (shouldTransfer && amount <= 0n) {
        toast.info('Nothing to rebalance', 'No moves to execute.');
        return false;
      }

      if (!hasBundler) {
        toast.error('Unsupported chain', 'Rebalance is not available on this chain.');
        return false;
      }

      setIsProcessing(true);

      try {
        await waitForPermit2State();

        const initialStep: RebalanceExecutionStepType = usePermit2Setting
          ? shouldTransfer
            ? permit2AuthorizedRef.current
              ? isBundlerAuthorized
                ? 'sign_permit'
                : 'authorize_bundler_sig'
              : 'approve_permit2'
            : isBundlerAuthorized
              ? 'execute'
              : 'authorize_bundler_sig'
          : shouldTransfer
            ? isBundlerAuthorized
              ? isTokenApproved
                ? 'execute'
                : 'approve_token'
              : 'authorize_bundler_tx'
            : isBundlerAuthorized
              ? 'execute'
              : 'authorize_bundler_tx';

        const flowSteps = getStepsForFlow(usePermit2Setting, loanAssetSymbol, shouldTransfer);

        tracking.start(
          flowSteps,
          {
            title: metadata.title,
            description: metadata.description,
            tokenSymbol: metadata.tokenSymbol,
            summaryItems: metadata.summaryItems,
          },
          initialStep,
        );

        const stepOrder = new Map(flowSteps.map((step, index) => [step.id, index]));
        let runtimeStep: RebalanceExecutionStepType = initialStep;
        const updateStepIfAdvancing = (nextStep: RebalanceExecutionStepType) => {
          const currentIndex = stepOrder.get(runtimeStep);
          const nextIndex = stepOrder.get(nextStep);
          if (nextIndex === undefined) return;
          if (currentIndex !== undefined && nextIndex <= currentIndex) return;

          tracking.update(nextStep);
          runtimeStep = nextStep;
        };

        const transactions: `0x${string}`[] = [];

        if (usePermit2Setting) {
          if (shouldTransfer) {
            updateStepIfAdvancing('approve_permit2');
            if (!permit2AuthorizedRef.current) {
              await authorizePermit2();
              await sleep(800);
            }

            updateStepIfAdvancing('authorize_bundler_sig');
            const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
            if (authorizationTxData) {
              transactions.push(authorizationTxData);
              await sleep(800);
            }

            updateStepIfAdvancing('sign_permit');
            const { sigs, permitSingle } = await signForBundlers(amount);

            const permitTx = encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'approve2',
              args: [permitSingle, sigs, false],
            });

            const transferFromTx = encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'transferFrom2',
              args: [loanAssetAddress, amount],
            });

            transactions.push(permitTx);
            transactions.push(...withdrawTxs);
            transactions.push(transferFromTx);
            transactions.push(...supplyTxs);
          } else {
            updateStepIfAdvancing('authorize_bundler_sig');
            const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
            if (authorizationTxData) {
              transactions.push(authorizationTxData);
              await sleep(800);
            }

            transactions.push(...withdrawTxs);
            transactions.push(...supplyTxs);
          }
        } else {
          updateStepIfAdvancing('authorize_bundler_tx');
          const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
          if (!authorized) {
            throw new Error('Failed to authorize Bundler via transaction.');
          }

          if (shouldTransfer) {
            updateStepIfAdvancing('approve_token');
            if (!isTokenApproved) {
              await approveToken();
              await sleep(1000);
            }

            const transferFromTx = encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'erc20TransferFrom',
              args: [loanAssetAddress, amount],
            });

            transactions.push(...withdrawTxs);
            transactions.push(transferFromTx);
            transactions.push(...supplyTxs);
          } else {
            transactions.push(...withdrawTxs);
            transactions.push(...supplyTxs);
          }
        }

        if (trailingTxs?.length) {
          transactions.push(...trailingTxs);
        }

        updateStepIfAdvancing('execute');

        const multicallTx = (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [transactions],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`;

        await sendTransactionAsync({
          account,
          to: bundlerAddress,
          data: multicallTx,
          chainId,
          gas: gasEstimate ? (gasEstimate * GAS_MULTIPLIER_NUMERATOR) / GAS_MULTIPLIER_DENOMINATOR : undefined,
        });

        onSubmitted?.();
        tracking.complete();
        return true;
      } catch (error) {
        tracking.fail();

        if (isUserRejected(error)) {
          toast.error('Transaction Rejected', 'User rejected transaction.');
        } else {
          toast.error('Rebalance Failed', 'An unexpected error occurred during rebalance.');
        }

        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      account,
      approveToken,
      authorizePermit2,
      bundlerAddress,
      chainId,
      ensureBundlerAuthorization,
      hasBundler,
      isBundlerAuthorized,
      isTokenApproved,
      loanAssetAddress,
      loanAssetSymbol,
      requiredAmount,
      sendTransactionAsync,
      signForBundlers,
      toast,
      tracking,
      usePermit2Setting,
      waitForPermit2State,
    ],
  );

  const isLoading = useMemo(
    () => isProcessing || isLoadingPermit2 || isTokenApproving || isAuthorizingBundler || isExecuting,
    [isProcessing, isLoadingPermit2, isTokenApproving, isAuthorizingBundler, isExecuting],
  );

  return {
    executeBundle,
    isProcessing: isLoading,
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as RebalanceExecutionStepType | null,
  };
}
