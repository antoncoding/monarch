import { useCallback } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection, useSwitchChain } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import type { Market } from '@/utils/types';
import { useERC20Approval } from './useERC20Approval';
import { useTransactionWithToast } from './useTransactionWithToast';
import { useTransactionTracking } from './useTransactionTracking';
import { useStyledToast } from './useStyledToast';
import { formatBalance } from '@/utils/balance';

type Borrower = {
  userAddress: string;
  borrowAssets: string;
  collateral: string;
};

type UseLiquidateTransactionProps = {
  market: Market;
  borrower: Borrower | null;
  seizedAssets: bigint;
  onSuccess?: () => void;
};

export function useLiquidateTransaction({ market, borrower, seizedAssets, onSuccess }: UseLiquidateTransactionProps) {
  const { address: account } = useConnection();
  const { mutateAsync: switchChainAsync } = useSwitchChain();
  const toast = useStyledToast();
  const tracking = useTransactionTracking('liquidate');

  const chainId = market.morphoBlue.chain.id;
  const morphoAddress = market.morphoBlue.address as Address;

  // Estimate the max repay amount (borrowAssets + buffer for interest)
  const maxRepayAmount = borrower ? (BigInt(borrower.borrowAssets) * 110n) / 100n : 0n;

  const { isApproved, approve, isApproving } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: morphoAddress,
    amount: maxRepayAmount,
    tokenSymbol: market.loanAsset.symbol,
    chainId,
  });

  const { isConfirming, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'liquidate',
    pendingText: 'Liquidating position',
    successText: 'Position Liquidated',
    errorText: 'Failed to liquidate',
    chainId,
    pendingDescription: `Liquidating borrower ${borrower?.userAddress.slice(0, 8)}...`,
    successDescription: 'Successfully liquidated position',
    onSuccess,
  });

  const steps = [
    { id: 'approve', title: 'Approve Token', description: `Approve ${market.loanAsset.symbol} for liquidation` },
    { id: 'liquidating', title: 'Confirm Liquidation', description: 'Confirm transaction in wallet' },
  ];

  const executeLiquidation = useCallback(async () => {
    if (!borrower || !account) return;

    await switchChainAsync({ chainId });

    tracking.update('liquidating');

    await sendTransactionAsync({
      account,
      to: morphoAddress,
      data: encodeFunctionData({
        abi: morphoAbi,
        functionName: 'liquidate',
        args: [
          {
            loanToken: market.loanAsset.address as Address,
            collateralToken: market.collateralAsset.address as Address,
            oracle: market.oracleAddress as Address,
            irm: market.irmAddress as Address,
            lltv: BigInt(market.lltv),
          },
          borrower.userAddress as Address,
          seizedAssets,
          0n, // repaidShares = 0 since we're specifying seizedAssets
          '0x', // callback data
        ],
      }),
    });

    tracking.complete();
  }, [borrower, account, switchChainAsync, chainId, sendTransactionAsync, morphoAddress, market, seizedAssets, tracking]);

  const approveAndLiquidate = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    if (!borrower) {
      toast.error('No borrower selected', 'Please select a borrower to liquidate.');
      return;
    }

    await switchChainAsync({ chainId: market.morphoBlue.chain.id });

    try {
      tracking.start(
        steps,
        {
          title: 'Liquidate Position',
          description: `Liquidating ${formatBalance(seizedAssets, market.collateralAsset.decimals)} ${market.collateralAsset.symbol}`,
          tokenSymbol: market.collateralAsset.symbol,
          amount: seizedAssets,
          marketId: market.uniqueKey,
        },
        'approve',
      );

      if (!isApproved) {
        await approve();
      }

      await executeLiquidation();
    } catch (error: unknown) {
      console.error('Error in liquidation:', error);
      tracking.fail();
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else if (error.message.includes('insufficient')) {
          toast.error('Insufficient balance', 'You need more loan tokens to liquidate this position');
        } else {
          toast.error('Liquidation failed', error.message);
        }
      }
    }
  }, [account, borrower, isApproved, approve, executeLiquidation, toast, tracking, steps, seizedAssets, market]);

  const signAndLiquidate = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    if (!borrower) {
      toast.error('No borrower selected', 'Please select a borrower to liquidate.');
      return;
    }

    try {
      tracking.start(
        [{ id: 'liquidating', title: 'Confirm Liquidation', description: 'Confirm transaction in wallet' }],
        {
          title: 'Liquidate Position',
          description: `Liquidating ${formatBalance(seizedAssets, market.collateralAsset.decimals)} ${market.collateralAsset.symbol}`,
          tokenSymbol: market.collateralAsset.symbol,
          amount: seizedAssets,
          marketId: market.uniqueKey,
        },
        'liquidating',
      );

      await executeLiquidation();
    } catch (error: unknown) {
      console.error('Error in liquidation:', error);
      tracking.fail();
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Liquidation failed', error.message);
        }
      }
    }
  }, [account, borrower, executeLiquidation, toast, tracking, seizedAssets, market]);

  return {
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    isApproved,
    isApproving,
    isConfirming,
    isLoading: isApproving || isConfirming,
    approveAndLiquidate,
    signAndLiquidate,
  };
}
