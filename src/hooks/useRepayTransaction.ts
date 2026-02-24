import { useCallback } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { BPS_DENOMINATOR, REPAY_BY_SHARES_BUFFER_BPS, REPAY_BY_SHARES_MIN_BUFFER_DECIMALS_OFFSET } from '@/constants/repay';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market, MarketPosition } from '@/utils/types';
import { useERC20Approval } from './useERC20Approval';
import { useBundlerAuthorizationStep } from './useBundlerAuthorizationStep';
import { usePermit2 } from './usePermit2';
import { useAppSettings } from '@/stores/useAppSettings';
import { useStyledToast } from './useStyledToast';
import { useTransactionWithToast } from './useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';

type UseRepayTransactionProps = {
  market: Market;
  currentPosition: MarketPosition | null;
  withdrawAmount: bigint;
  repayAssets: bigint;
  repayShares: bigint;
  onSuccess?: () => void;
};

const roundUpDiv = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator === 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
};

const getRepayBySharesBufferFloor = (tokenDecimals: number): bigint => {
  const exponent = Math.max(0, tokenDecimals - REPAY_BY_SHARES_MIN_BUFFER_DECIMALS_OFFSET);
  return 10n ** BigInt(exponent);
};

const calculateRepayBySharesBufferedAssets = (baseAssets: bigint, tokenDecimals: number): bigint => {
  if (baseAssets <= 0n) return 0n;
  const bpsBuffer = roundUpDiv(baseAssets * REPAY_BY_SHARES_BUFFER_BPS, BPS_DENOMINATOR);
  const floorBuffer = getRepayBySharesBufferFloor(tokenDecimals);
  return baseAssets + (bpsBuffer > floorBuffer ? bpsBuffer : floorBuffer);
};

export function useRepayTransaction({
  market,
  currentPosition,
  withdrawAmount,
  repayAssets,
  repayShares,
  onSuccess,
}: UseRepayTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();

  // Transaction tracking
  const tracking = useTransactionTracking('repay');

  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const bundlerAddress = getBundlerV2(market.morphoBlue.chain.id);

  const useRepayByShares = repayShares > 0n;
  const repayBySharesBaseAssets = useRepayByShares && repayAssets === 0n ? BigInt(currentPosition?.state.borrowAssets ?? 0) : repayAssets;
  const repayAmountToApprove = useRepayByShares
    ? calculateRepayBySharesBufferedAssets(repayBySharesBaseAssets, market.loanAsset.decimals)
    : repayAssets;

  const { isAuthorizingBundler, ensureBundlerAuthorization } = useBundlerAuthorizationStep({
    chainId: market.morphoBlue.chain.id,
    bundlerAddress: bundlerAddress as Address,
  });

  // Get approval for loan token
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: bundlerAddress,
    token: market.loanAsset.address as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.loanAsset.symbol,
    amount: repayAmountToApprove,
  });

  const { isApproved, approve } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: bundlerAddress as Address,
    amount: repayAmountToApprove,
    tokenSymbol: market.loanAsset.symbol,
  });

  const { isConfirming: repayPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'repay',
    pendingText: `${
      repayAssets > 0n || repayShares > 0n
        ? `Repaying ${formatBalance(repayAssets, market.loanAsset.decimals).toString()} ${market.loanAsset.symbol}`
        : ''
    }${
      withdrawAmount > 0n
        ? (repayAssets > 0n || repayShares > 0n ? ' and ' : '') +
          'Withdrawing ' +
          formatBalance(withdrawAmount, market.collateralAsset.decimals).toString() +
          ' ' +
          market.collateralAsset.symbol
        : ''
    }`,
    successText: `${repayAssets > 0n || repayShares > 0n ? `${market.loanAsset.symbol} Repaid` : ''}${
      withdrawAmount > 0n ? `${(repayAssets > 0n || repayShares > 0n ? ' and ' : '') + market.collateralAsset.symbol} Withdrawn` : ''
    }`,
    errorText: 'Transaction failed',
    chainId,
    pendingDescription: `Processing transaction for market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully processed transaction for market ${market.uniqueKey.slice(2, 8)}`,
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
          { id: 'signing', title: 'Sign message in wallet', description: 'Sign a Permit2 signature to authorize the repayment' },
          { id: 'repaying', title: 'Confirm Repay', description: 'Confirm transaction in wallet to complete the repayment' },
        ];
      }
      return [
        { id: 'approve', title: 'Approve Token', description: `Approve ${market.loanAsset.symbol} for spending` },
        { id: 'repaying', title: 'Confirm Repay', description: 'Confirm transaction in wallet to complete the repayment' },
      ];
    },
    [market.loanAsset.symbol],
  );

  // Core transaction execution logic
  const executeRepayTransaction = useCallback(async () => {
    if (!currentPosition) {
      toast.error('No Position', 'No active position found');
      return;
    }

    try {
      const txs: `0x${string}`[] = [];

      if (withdrawAmount > 0n) {
        if (usePermit2Setting) {
          const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
          if (authorizationTxData) {
            txs.push(authorizationTxData);
          }
        } else {
          const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
          if (!authorized) {
            throw new Error('Failed to authorize Bundler for collateral withdrawal.');
          }
        }
      }

      // Add token approval and transfer transactions if repaying
      if ((repayAssets > 0n || repayShares > 0n) && repayAmountToApprove > 0n) {
        if (usePermit2Setting) {
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
            args: [market.loanAsset.address as Address, repayAmountToApprove],
          });

          txs.push(tx1);
          txs.push(tx2);
        } else {
          // For standard ERC20 flow, we only need to transfer the tokens
          txs.push(
            encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'erc20TransferFrom',
              args: [market.loanAsset.address as Address, repayAmountToApprove],
            }),
          );
        }
      }

      // Add the repay transaction if there's an amount to repay

      if (useRepayByShares) {
        const morphoRepayTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoRepay',
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            0n, // assets to repay (0)
            repayShares, // shares to repay
            repayAmountToApprove, // Slippage amount: max amount to repay
            account as Address,
            '0x', // bytes
          ],
        });
        txs.push(morphoRepayTx);

        // build another erc20 transfer action, to transfer any surplus back (unused loan assets) back to the user
        const refundTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'erc20Transfer',
          args: [market.loanAsset.address as Address, account as Address, repayAmountToApprove],
        });
        txs.push(refundTx);
      } else if (repayAssets > 0n) {
        const minShares = 1n;
        const morphoRepayTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoRepay',
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            repayAssets, // assets to repay
            0n, // shares to repay (0)
            minShares, // Slippage amount: min shares to repay
            account as Address,
            '0x', // bytes
          ],
        });
        txs.push(morphoRepayTx);
      }

      // Add the withdraw transaction if there's an amount to withdraw
      if (withdrawAmount > 0n) {
        const morphoWithdrawTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoWithdrawCollateral',
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            withdrawAmount,
            account as Address,
          ],
        });
        txs.push(morphoWithdrawTx);
      }

      tracking.update('repaying');

      // Add timeout to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await sendTransactionAsync({
        account,
        to: bundlerAddress,
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
      });

      tracking.complete();
    } catch (error: unknown) {
      console.error('Error in repay transaction:', error);
      tracking.fail();
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
  }, [
    account,
    market,
    currentPosition,
    withdrawAmount,
    repayAssets,
    repayShares,
    sendTransactionAsync,
    signForBundlers,
    usePermit2Setting,
    ensureBundlerAuthorization,
    toast,
    useRepayByShares,
    repayAmountToApprove,
    bundlerAddress,
    tracking,
  ]);

  // Combined approval and repay flow
  const approveAndRepay = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      const txTitle = withdrawAmount > 0n ? 'Withdraw & Repay' : 'Repay';
      tracking.start(
        getStepsForFlow(usePermit2Setting),
        {
          title: txTitle,
          description: `Repaying ${market.loanAsset.symbol}`,
          tokenSymbol: market.loanAsset.symbol,
          amount: repayAssets,
          marketId: market.uniqueKey,
        },
        'approve',
      );

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          await authorizePermit2();
          tracking.update('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));

          await executeRepayTransaction();
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
      } else {
        // ERC20 approval flow or just withdraw
        if (!isApproved) {
          try {
            await approve();
          } catch (error: unknown) {
            console.error('Error in approval:', error);
            tracking.fail();
            if (error instanceof Error) {
              if (error.message.includes('User rejected')) {
                toast.error('Approval rejected', 'Approval rejected by user');
              } else {
                toast.error('Approval Error', 'Failed to approve token');
              }
            } else {
              toast.error('Approval Error', 'An unexpected error occurred');
            }
            return;
          }
        }

        tracking.update('repaying');
        await executeRepayTransaction();
      }
    } catch (error: unknown) {
      console.error('Error in approveAndRepay:', error);
      tracking.fail();
    }
  }, [
    account,
    authorizePermit2,
    executeRepayTransaction,
    usePermit2Setting,
    isApproved,
    approve,
    toast,
    tracking,
    getStepsForFlow,
    market,
    repayAssets,
    withdrawAmount,
  ]);

  // Function to handle signing and executing the repay transaction
  const signAndRepay = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      const txTitle = withdrawAmount > 0n ? 'Withdraw & Repay' : 'Repay';
      tracking.start(
        getStepsForFlow(usePermit2Setting),
        {
          title: txTitle,
          description: `Repaying ${market.loanAsset.symbol}`,
          tokenSymbol: market.loanAsset.symbol,
          amount: repayAssets,
          marketId: market.uniqueKey,
        },
        usePermit2Setting ? 'signing' : 'repaying',
      );

      await executeRepayTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndRepay:', error);
      tracking.fail();
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
  }, [account, executeRepayTransaction, toast, tracking, getStepsForFlow, usePermit2Setting, market, repayAssets, withdrawAmount]);

  return {
    // Transaction tracking
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as 'approve' | 'signing' | 'repaying' | null,
    // State
    isLoadingPermit2: isLoadingPermit2 || isAuthorizingBundler,
    isApproved,
    permit2Authorized,
    repayPending,
    // Actions
    approveAndRepay,
    signAndRepay,
  };
}
