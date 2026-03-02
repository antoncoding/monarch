import { useState, useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, maxUint256 } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { GAS_COSTS } from '@/features/markets/components/constants';
import { useStyledToast } from '@/hooks/useStyledToast';
import type { GroupedPosition, RebalanceAction } from '@/utils/types';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useConnection } from 'wagmi';
import { useRebalanceExecution, type RebalanceExecutionStepType } from './useRebalanceExecution';

export const useRebalance = (groupedPosition: GroupedPosition, onRebalance?: () => void) => {
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const toast = useStyledToast();
  const { address: account } = useConnection();

  const totalAmount = useMemo(() => rebalanceActions.reduce((acc, action) => acc + BigInt(action.amount), 0n), [rebalanceActions]);

  const { batchAddUserMarkets } = useUserMarketsCache(account);

  const handleTxSuccess = useCallback(() => {
    setRebalanceActions([]);
    onRebalance?.();
  }, [onRebalance]);

  const execution = useRebalanceExecution({
    chainId: groupedPosition.chainId,
    loanAssetAddress: groupedPosition.loanAssetAddress as Address,
    loanAssetSymbol: groupedPosition.loanAsset,
    requiredAmount: totalAmount,
    trackingType: 'rebalance',
    toastId: 'rebalance',
    pendingText: 'Rebalancing positions',
    successText: 'Positions rebalanced successfully',
    errorText: 'Failed to rebalance positions',
    onSuccess: handleTxSuccess,
  });

  const addRebalanceAction = useCallback((action: RebalanceAction) => {
    setRebalanceActions((prev) => [...prev, action]);
  }, []);

  const removeRebalanceAction = useCallback((index: number) => {
    setRebalanceActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const generateRebalanceTxData = useCallback(() => {
    if (!account) throw new Error('Wallet not connected');

    const withdrawTxs: `0x${string}`[] = [];
    const supplyTxs: `0x${string}`[] = [];
    const allMarketKeys: string[] = [];

    const groupedWithdraws: Record<string, RebalanceAction[]> = {};
    const groupedSupplies: Record<string, RebalanceAction[]> = {};

    for (const action of rebalanceActions) {
      const withdrawKey = action.fromMarket.uniqueKey;
      const supplyKey = action.toMarket.uniqueKey;

      if (!groupedWithdraws[withdrawKey]) groupedWithdraws[withdrawKey] = [];
      if (!groupedSupplies[supplyKey]) groupedSupplies[supplyKey] = [];

      groupedWithdraws[withdrawKey].push(action);
      groupedSupplies[supplyKey].push(action);

      if (!allMarketKeys.includes(withdrawKey)) allMarketKeys.push(withdrawKey);
      if (!allMarketKeys.includes(supplyKey)) allMarketKeys.push(supplyKey);
    }

    for (const actions of Object.values(groupedWithdraws)) {
      const batchAmount = actions.reduce((sum, action) => sum + BigInt(action.amount), 0n);
      const isWithdrawMax = actions.some((action) => action.isMax);
      const shares = isWithdrawMax
        ? groupedPosition.markets.find((m) => m.market.uniqueKey === actions[0].fromMarket.uniqueKey)?.state.supplyShares
        : undefined;

      if (isWithdrawMax && shares === undefined) {
        throw new Error(`No shares found for max withdraw from market ${actions[0].fromMarket.uniqueKey}`);
      }

      const market = actions[0].fromMarket;
      if (!market.loanToken || !market.collateralToken || !market.oracle || !market.irm || market.lltv === undefined) {
        throw new Error(`Market data incomplete for withdraw from ${market.uniqueKey}`);
      }

      const withdrawTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoWithdraw',
        args: [
          {
            loanToken: market.loanToken as Address,
            collateralToken: market.collateralToken as Address,
            oracle: market.oracle as Address,
            irm: market.irm as Address,
            lltv: BigInt(market.lltv),
          },
          isWithdrawMax ? 0n : batchAmount,
          isWithdrawMax ? BigInt(shares as string) : 0n,
          isWithdrawMax ? batchAmount : maxUint256,
          account,
        ],
      });
      withdrawTxs.push(withdrawTx);
    }

    for (const actions of Object.values(groupedSupplies)) {
      const batchedAmount = actions.reduce((sum, action) => sum + BigInt(action.amount), 0n);
      const market = actions[0].toMarket;

      if (!market.loanToken || !market.collateralToken || !market.oracle || !market.irm || market.lltv === undefined) {
        throw new Error(`Market data incomplete for supply to ${market.uniqueKey}`);
      }

      const supplyTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoSupply',
        args: [
          {
            loanToken: market.loanToken as Address,
            collateralToken: market.collateralToken as Address,
            oracle: market.oracle as Address,
            irm: market.irm as Address,
            lltv: BigInt(market.lltv),
          },
          batchedAmount,
          0n,
          1n,
          account,
          '0x',
        ],
      });
      supplyTxs.push(supplyTx);
    }

    return { withdrawTxs, supplyTxs, allMarketKeys };
  }, [account, groupedPosition.markets, rebalanceActions]);

  const executeRebalance = useCallback(async () => {
    if (rebalanceActions.length === 0) {
      toast.info('No actions', 'Please add rebalance actions first.');
      return false;
    }

    const { withdrawTxs, supplyTxs, allMarketKeys } = generateRebalanceTxData();

    let gasEstimate = GAS_COSTS.BUNDLER_REBALANCE;
    if (supplyTxs.length > 1) {
      gasEstimate += GAS_COSTS.SINGLE_SUPPLY * BigInt(supplyTxs.length - 1);
    }
    if (withdrawTxs.length > 1) {
      gasEstimate += GAS_COSTS.SINGLE_WITHDRAW * BigInt(withdrawTxs.length - 1);
    }

    return execution.executeBundle({
      metadata: {
        title: 'Rebalance',
        description: `Rebalancing ${groupedPosition.loanAsset} positions`,
        tokenSymbol: groupedPosition.loanAsset,
      },
      withdrawTxs,
      supplyTxs,
      gasEstimate,
      onSubmitted: () => {
        batchAddUserMarkets(
          allMarketKeys.map((marketUniqueKey) => ({
            marketUniqueKey,
            chainId: groupedPosition.chainId,
          })),
        );
      },
    });
  }, [
    batchAddUserMarkets,
    execution,
    generateRebalanceTxData,
    groupedPosition.chainId,
    groupedPosition.loanAsset,
    rebalanceActions.length,
    toast,
  ]);

  return {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isProcessing: execution.isProcessing,
    transaction: execution.transaction,
    dismiss: execution.dismiss,
    currentStep: execution.currentStep as RebalanceExecutionStepType | null,
  };
};
