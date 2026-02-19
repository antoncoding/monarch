import { useCallback } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import { formatBalance } from '@/utils/balance';
import { getMorphoAddress } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { useERC20Approval } from './useERC20Approval';
import { useTransactionWithToast } from './useTransactionWithToast';
import { useTransactionTracking } from './useTransactionTracking';

type UseLiquidateTransactionProps = {
  market: Market;
  borrower: Address;
  seizedAssets: bigint;
  repaidShares: bigint;
  repayAmount: bigint; // loan token amount for approval
  onSuccess?: () => void;
};

export function useLiquidateTransaction({
  market,
  borrower,
  seizedAssets,
  repaidShares,
  repayAmount,
  onSuccess,
}: UseLiquidateTransactionProps) {
  const { address: account, chainId } = useConnection();

  const tracking = useTransactionTracking('liquidate');
  const morphoAddress = chainId ? getMorphoAddress(chainId) : undefined;
  const hasSeizedAssets = seizedAssets > 0n;
  const hasRepaidShares = repaidShares > 0n;
  const hasExactlyOneLiquidationMode = hasSeizedAssets !== hasRepaidShares;

  // Liquidation repays debt in both modes:
  // - repaidShares > 0 (max/share-based)
  // - seizedAssets > 0 (asset-based)
  const approvalAmount = hasExactlyOneLiquidationMode ? repayAmount : 0n;

  const { isApproved, approve } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: morphoAddress ?? '0x',
    amount: approvalAmount,
    tokenSymbol: market.loanAsset.symbol,
    chainId,
  });

  const { isConfirming: liquidatePending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'liquidate',
    pendingText: `Liquidating ${formatBalance(seizedAssets, market.collateralAsset.decimals)} ${market.collateralAsset.symbol}`,
    successText: 'Liquidation successful',
    errorText: 'Failed to liquidate',
    chainId,
    pendingDescription: `Liquidating borrower ${borrower.slice(0, 6)}...`,
    successDescription: `Successfully liquidated ${borrower.slice(0, 6)}`,
    onSuccess,
    ...tracking,
  });

  const liquidate = useCallback(async () => {
    if (!account || !chainId || !morphoAddress) return;
    if (!hasExactlyOneLiquidationMode) {
      throw new Error('Invalid liquidation params: exactly one of seizedAssets or repaidShares must be non-zero');
    }

    const marketParams = {
      loanToken: market.loanAsset.address as `0x${string}`,
      collateralToken: market.collateralAsset.address as `0x${string}`,
      oracle: market.oracleAddress as `0x${string}`,
      irm: market.irmAddress as `0x${string}`,
      lltv: BigInt(market.lltv),
    };

    const liquidateTx = encodeFunctionData({
      abi: morphoAbi,
      functionName: 'liquidate',
      args: [marketParams, borrower, hasSeizedAssets ? seizedAssets : 0n, hasRepaidShares ? repaidShares : 0n, '0x'],
    });

    await sendTransactionAsync({ to: morphoAddress as Address, data: liquidateTx });
  }, [
    account,
    chainId,
    market,
    borrower,
    hasExactlyOneLiquidationMode,
    hasSeizedAssets,
    seizedAssets,
    hasRepaidShares,
    repaidShares,
    morphoAddress,
    sendTransactionAsync,
  ]);

  const handleLiquidate = useCallback(async () => {
    if (!hasExactlyOneLiquidationMode) {
      throw new Error('Invalid liquidation params: exactly one of seizedAssets or repaidShares must be non-zero');
    }
    if (!isApproved) await approve();
    await liquidate();
  }, [hasExactlyOneLiquidationMode, isApproved, approve, liquidate]);

  return { liquidatePending, liquidate, handleLiquidate };
}
