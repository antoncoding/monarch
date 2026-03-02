import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, maxUint256 } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { GAS_COSTS } from '@/features/markets/components/constants';
import { SMART_REBALANCE_FEE_RECIPIENT } from '@/config/smart-rebalance';
import type { GroupedPosition } from '@/utils/types';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import type { SmartRebalancePlan } from '@/features/positions/smart-rebalance/planner';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useRebalanceExecution, type RebalanceExecutionStepType } from './useRebalanceExecution';
import { useConnection } from 'wagmi';

const SMART_REBALANCE_FEE_BPS = 10n; // measured in tenths of a BPS.
const FEE_BPS_DENOMINATOR = 100_000n;

function computeFeeForDelta(delta: bigint): bigint {
  if (delta <= 0n) return 0n;
  return (delta * SMART_REBALANCE_FEE_BPS) / FEE_BPS_DENOMINATOR;
}

export const useSmartRebalance = (groupedPosition: GroupedPosition, plan: SmartRebalancePlan | null, onSuccess?: () => void) => {
  const { address: account } = useConnection();
  const { batchAddUserMarkets } = useUserMarketsCache(account);

  const totalMoved = useMemo(() => {
    if (!plan) return 0n;
    return plan.totalMoved;
  }, [plan]);

  const feeAmount = useMemo(() => {
    if (!plan) return 0n;
    return plan.deltas.reduce((sum, delta) => sum + computeFeeForDelta(delta.delta), 0n);
  }, [plan]);

  const execution = useRebalanceExecution({
    chainId: groupedPosition.chainId,
    loanAssetAddress: groupedPosition.loanAssetAddress as Address,
    loanAssetSymbol: groupedPosition.loanAsset,
    requiredAmount: totalMoved,
    trackingType: 'smart-rebalance',
    toastId: 'smart-rebalance',
    pendingText: 'Smart rebalancing positions',
    successText: 'Smart rebalance completed successfully',
    errorText: 'Failed to smart rebalance positions',
    onSuccess,
  });

  const generateSmartRebalanceTxData = useCallback(() => {
    if (!plan || !account) {
      throw new Error('Missing smart-rebalance plan');
    }

    const withdrawTxs: `0x${string}`[] = [];
    const supplyTxs: `0x${string}`[] = [];
    const touchedMarketKeys = new Set<string>();

    for (const delta of plan.deltas) {
      if (delta.delta >= 0n) continue;

      const withdrawAmount = -delta.delta;
      const market = delta.market;
      touchedMarketKeys.add(market.uniqueKey);
      const supplyShares = BigInt(
        groupedPosition.markets.find((position) => position.market.uniqueKey === market.uniqueKey)?.state.supplyShares ?? '0',
      );
      const isFullWithdraw = delta.targetAmount === 0n && supplyShares > 0n;

      if (
        !market.loanAsset?.address ||
        !market.collateralAsset?.address ||
        !market.oracleAddress ||
        !market.irmAddress ||
        market.lltv === undefined
      ) {
        throw new Error(`Market data incomplete for withdraw from ${market.uniqueKey}`);
      }

      const marketParams = {
        loanToken: market.loanAsset.address as Address,
        collateralToken: market.collateralAsset.address as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      };

      withdrawTxs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoWithdraw',
          args: [
            marketParams,
            isFullWithdraw ? 0n : withdrawAmount,
            isFullWithdraw ? supplyShares : 0n,
            isFullWithdraw ? withdrawAmount : maxUint256,
            account,
          ],
        }),
      );
    }

    for (const delta of plan.deltas) {
      if (delta.delta <= 0n) continue;

      const market = delta.market;
      touchedMarketKeys.add(market.uniqueKey);

      if (
        !market.loanAsset?.address ||
        !market.collateralAsset?.address ||
        !market.oracleAddress ||
        !market.irmAddress ||
        market.lltv === undefined
      ) {
        throw new Error(`Market data incomplete for supply to ${market.uniqueKey}`);
      }

      const marketParams = {
        loanToken: market.loanAsset.address as Address,
        collateralToken: market.collateralAsset.address as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      };

      const reducedAmount = delta.delta - computeFeeForDelta(delta.delta);
      if (reducedAmount <= 0n) continue;

      supplyTxs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoSupply',
          args: [marketParams, reducedAmount, 0n, 1n, account, '0x'],
        }),
      );
    }

    return { withdrawTxs, supplyTxs, allMarketKeys: [...touchedMarketKeys] };
  }, [account, groupedPosition.markets, plan]);

  const executeSmartRebalance = useCallback(
    async (summaryItems?: TransactionSummaryItem[]) => {
      if (!plan || !account || totalMoved === 0n) {
        return false;
      }

      const { withdrawTxs, supplyTxs, allMarketKeys } = generateSmartRebalanceTxData();
      const isWithdrawOnly = supplyTxs.length === 0;

      let gasEstimate = GAS_COSTS.BUNDLER_REBALANCE;
      if (supplyTxs.length > 1) {
        gasEstimate += GAS_COSTS.SINGLE_SUPPLY * BigInt(supplyTxs.length - 1);
      }
      if (withdrawTxs.length > 1) {
        gasEstimate += GAS_COSTS.SINGLE_WITHDRAW * BigInt(withdrawTxs.length - 1);
      }

      const trailingTxs = isWithdrawOnly
        ? []
        : [
            encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'erc20Transfer',
              args: [groupedPosition.loanAssetAddress as Address, SMART_REBALANCE_FEE_RECIPIENT, maxUint256],
            }),
          ];

      return execution.executeBundle({
        metadata: {
          title: 'Smart Rebalance',
          description: `Smart rebalancing ${groupedPosition.loanAsset} positions`,
          tokenSymbol: groupedPosition.loanAsset,
          summaryItems,
        },
        withdrawTxs,
        supplyTxs,
        trailingTxs,
        gasEstimate,
        transferAmount: isWithdrawOnly ? 0n : totalMoved,
        requiresAssetTransfer: !isWithdrawOnly,
        onSubmitted: () => {
          batchAddUserMarkets(
            allMarketKeys.map((marketUniqueKey) => ({
              marketUniqueKey,
              chainId: groupedPosition.chainId,
            })),
          );
        },
      });
    },
    [
      account,
      batchAddUserMarkets,
      execution,
      generateSmartRebalanceTxData,
      groupedPosition.chainId,
      groupedPosition.loanAsset,
      groupedPosition.loanAssetAddress,
      plan,
      totalMoved,
    ],
  );

  return {
    executeSmartRebalance,
    isProcessing: execution.isProcessing,
    totalMoved,
    feeAmount,
    transaction: execution.transaction,
    dismiss: execution.dismiss,
    currentStep: execution.currentStep as RebalanceExecutionStepType | null,
  };
};
