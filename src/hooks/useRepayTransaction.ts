import { useCallback, useState } from 'react';
import { Address, encodeFunctionData } from 'viem';
import { useAccount } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { Market, MarketPosition } from '@/utils/types';
import { useStyledToast } from './useStyledToast';
import { useTransactionWithToast } from './useTransactionWithToast';

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
  const [currentStep, setCurrentStep] = useState<'signing' | 'repaying'>('signing');
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [useEth, setUseEth] = useState<boolean>(false);

  const { address: account, chainId } = useAccount();
  const toast = useStyledToast();

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

      
      // Add the repay transaction if there's an amount to repay
      if (repayShares > 0n) {

        const maxRepayAmount = repayAssets - 1n;
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
            0n,
            repayShares, // shares to repay (0), we always use assets as param
            maxRepayAmount,// Slippage amount: min amount received
            account as Address,
            account as Address,
          ],
        });
        txs.push(morphoRepayTx);

      } else {
        const minShares = repayShares + 1n;
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
            repayAssets,
            0n, // shares to repay (0), we always use assets as param
            minShares,// Slippage amount: min amount received
            account as Address,
            account as Address,
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
    useEth,
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
    }
  }, [account, executeRepayTransaction, toast]);

  return {
    // State
    currentStep,
    showProcessModal,
    setShowProcessModal,
    useEth,
    setUseEth,
    repayPending,

    // Actions
    signAndRepay,
  };
} 