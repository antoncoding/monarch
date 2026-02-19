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
  onSuccess?: () => void;
};

export function useLiquidateTransaction({ market, borrower, seizedAssets, repaidShares, onSuccess }: UseLiquidateTransactionProps) {
  const { address: account, chainId } = useConnection();

  const tracking = useTransactionTracking('liquidate');
  const morphoAddress = getMorphoAddress(chainId);

  const { isApproved, approve } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: morphoAddress,
    amount: 0n,
    tokenSymbol: market.loanAsset.symbol,
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
    if (!account || !chainId) return;

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
      args: [marketParams, borrower, seizedAssets, repaidShares, '0x'],
    });

    await sendTransactionAsync({ to: morphoAddress, data: liquidateTx });
  }, [account, chainId, market, borrower, seizedAssets, repaidShares, morphoAddress, sendTransactionAsync]);

  const handleLiquidate = useCallback(async () => {
    if (!isApproved) await approve();
    await liquidate();
  }, [isApproved, approve, liquidate]);

  return { liquidatePending, liquidate, handleLiquidate };
}
