import { useCallback, useState } from 'react';
import { Address, encodeFunctionData } from 'viem';
import { useAccount } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { Market, MarketPosition } from '@/utils/types';
import { useStyledToast } from './useStyledToast';
import { useTransactionWithToast } from './useTransactionWithToast';
import { usePermit2 } from './usePermit2';
import { useERC20Approval } from './useERC20Approval';
import { useLocalStorage } from './useLocalStorage';

type UseRepayTransactionProps = {
  market: Market;
  currentPosition: MarketPosition | null;
  withdrawAmount: bigint;
  repayAssets: bigint;
  repayShares: bigint;
};

export function useRepayTransaction({
  market,
  currentPosition,
  withdrawAmount,
  repayAssets,
  repayShares
}: UseRepayTransactionProps) {
  const [currentStep, setCurrentStep] = useState<'approve' | 'signing' | 'repaying'>('approve');
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  const { address: account, chainId } = useAccount();
  const toast = useStyledToast();

  const useRepayByShares = repayShares > 0n;

  // If we're using repay by shares, we need to add a small amount as buffer to the repay amount we're approving
  const repayAmountToApprove = useRepayByShares ? repayAssets + 10n : repayAssets;

  console.log('repayAmountToApprove', repayAmountToApprove);

  // Get approval for loan token
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    token: market.loanAsset.address as `0x${string}`,
    refetchInterval: 10000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.loanAsset.symbol,
    amount: repayAmountToApprove,
  });

  const { isApproved, approve } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    amount: repayAmountToApprove,
    tokenSymbol: market.loanAsset.symbol,
  });

  const { isConfirming: repayPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'repay',
    pendingText: `Repaying ${formatBalance(repayAssets, market.loanAsset.decimals)} ${
      market.loanAsset.symbol
    }`,
    successText: `${market.loanAsset.symbol} Repaid`,
    errorText: 'Failed to repay',
    chainId,
    pendingDescription: `Repaying to market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully repaid to market ${market.uniqueKey.slice(2, 8)}`,
  });

  // Core transaction execution logic
  const executeRepayTransaction = useCallback(async () => {
    if (!currentPosition) {
      toast.error('No Position', 'No active position found to repay');
      return;
    }

    try {
      const txs: `0x${string}`[] = [];

      // Add token approval and transfer transactions if repaying
      if (repayAssets > 0n || repayShares > 0n) {
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
            repayAmountToApprove,// Slippage amount: max amount to repay
            account as Address,
            '0x', // bytes
          ],
        });
        txs.push(morphoRepayTx);

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
            minShares,// Slippage amount: min shares to repay
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
            account as Address
          ],
        });
        txs.push(morphoWithdrawTx);
      }

      setCurrentStep('repaying');

      // Add timeout to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await sendTransactionAsync({
        account,
        to: getBundlerV2(market.morphoBlue.chain.id),
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
      });

      setShowProcessModal(false);
    } catch (error: unknown) {
      console.error('Error in repay transaction:', error);
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
    toast,
    useRepayByShares,
    repayAmountToApprove,
  ]);

  // Combined approval and repay flow
  const approveAndRepay = useCallback(async () => {
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
          await authorizePermit2();
          setCurrentStep('signing');

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
        // ERC20 approval flow
        if (!isApproved) {
          try {
            await approve();
          } catch (error: unknown) {
            console.error('Error in approval:', error);
            setShowProcessModal(false);
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

        setCurrentStep('repaying');
        await executeRepayTransaction();
      }
    } catch (error: unknown) {
      console.error('Error in approveAndRepay:', error);
      setShowProcessModal(false);
    }
  }, [
    account,
    authorizePermit2,
    executeRepayTransaction,
    usePermit2Setting,
    isApproved,
    approve,
    toast,
  ]);

  // Function to handle signing and executing the repay transaction
  const signAndRepay = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('signing');
      await executeRepayTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndRepay:', error);
      setShowProcessModal(false);
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          console.log('Error in signAndRepay:', error);
          toast.error('Transaction Error', 'Failed to process transaction');
        }
      } else {
        toast.error('Transaction Error', 'An unexpected error occurred');
      }
    }
  }, [account, executeRepayTransaction, toast]);

  return {
    // State
    currentStep,
    showProcessModal,
    setShowProcessModal,
    isLoadingPermit2,
    isApproved,
    permit2Authorized,
    repayPending,

    // Actions
    approveAndRepay,
    signAndRepay,
  };
} 