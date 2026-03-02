import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, formatUnits, maxUint256, parseUnits } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { getTokenPriceKey } from '@/data-sources/morpho-api/prices';
import { GAS_COSTS } from '@/features/markets/components/constants';
import { SMART_REBALANCE_FEE_RECIPIENT } from '@/config/smart-rebalance';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import type { GroupedPosition } from '@/utils/types';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import type { SmartRebalancePlan } from '@/features/positions/smart-rebalance/planner';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useRebalanceExecution, type RebalanceExecutionStepType } from './useRebalanceExecution';
import { useConnection } from 'wagmi';

const SMART_REBALANCE_FEE_BPS = 4n; // measured in tenths of a BPS (0.4 bps = 0.004%).
const FEE_BPS_DENOMINATOR = 100_000n;
const SMART_REBALANCE_MAX_FEE_USD = 4;

type SmartRebalanceFeeBreakdown = {
  totalFee: bigint;
  feeByMarket: Map<string, bigint>;
};

function computeBaseFeeForDelta(delta: bigint): bigint {
  if (delta <= 0n) return 0n;
  return (delta * SMART_REBALANCE_FEE_BPS) / FEE_BPS_DENOMINATOR;
}

function deriveLoanAssetPriceUsdFromPlan(plan: SmartRebalancePlan, loanAssetDecimals: number): number | null {
  for (const delta of plan.deltas) {
    const market = delta.market;
    if (!market.hasUSDPrice) continue;

    const totalSupplyAssets = BigInt(market.state.supplyAssets);
    const totalSupplyAssetsUsd = market.state.supplyAssetsUsd;
    if (totalSupplyAssets <= 0n || !Number.isFinite(totalSupplyAssetsUsd) || totalSupplyAssetsUsd <= 0) continue;

    const totalSupplyToken = Number(formatUnits(totalSupplyAssets, loanAssetDecimals));
    if (!Number.isFinite(totalSupplyToken) || totalSupplyToken <= 0) continue;

    const priceUsd = totalSupplyAssetsUsd / totalSupplyToken;
    if (Number.isFinite(priceUsd) && priceUsd > 0) return priceUsd;
  }

  return null;
}

function computeFeeCapInLoanAssetUnits(loanAssetPriceUsd: number, loanAssetDecimals: number): bigint {
  if (!Number.isFinite(loanAssetPriceUsd) || loanAssetPriceUsd <= 0) return 0n;

  const cappedAmountInLoanAsset = SMART_REBALANCE_MAX_FEE_USD / loanAssetPriceUsd;
  if (!Number.isFinite(cappedAmountInLoanAsset) || cappedAmountInLoanAsset <= 0) return 0n;

  const precision = Math.min(loanAssetDecimals, 18);
  const cappedAmountString = cappedAmountInLoanAsset.toFixed(precision);
  return parseUnits(cappedAmountString, loanAssetDecimals);
}

function computeFeeBreakdown(
  plan: SmartRebalancePlan | null,
  loanAssetDecimals: number,
  pricedLoanAssetUsd: number | null,
): SmartRebalanceFeeBreakdown {
  if (!plan) {
    return { totalFee: 0n, feeByMarket: new Map<string, bigint>() };
  }

  const feeByMarket = new Map<string, bigint>();
  const baseFees = plan.deltas
    .filter((delta) => delta.delta > 0n)
    .map((delta) => ({
      uniqueKey: delta.market.uniqueKey,
      fee: computeBaseFeeForDelta(delta.delta),
    }))
    .filter((entry) => entry.fee > 0n);

  const uncappedTotal = baseFees.reduce((sum, entry) => sum + entry.fee, 0n);
  if (uncappedTotal === 0n) {
    return { totalFee: 0n, feeByMarket };
  }

  const fallbackPriceUsd = deriveLoanAssetPriceUsdFromPlan(plan, loanAssetDecimals);
  const effectiveLoanAssetPriceUsd = pricedLoanAssetUsd ?? fallbackPriceUsd;
  const feeCap =
    effectiveLoanAssetPriceUsd !== null ? computeFeeCapInLoanAssetUnits(effectiveLoanAssetPriceUsd, loanAssetDecimals) : uncappedTotal;

  let remainingFee = feeCap < uncappedTotal ? feeCap : uncappedTotal;
  for (const entry of baseFees) {
    if (remainingFee <= 0n) {
      feeByMarket.set(entry.uniqueKey, 0n);
      continue;
    }

    const allocatedFee = entry.fee < remainingFee ? entry.fee : remainingFee;
    feeByMarket.set(entry.uniqueKey, allocatedFee);
    remainingFee -= allocatedFee;
  }

  return {
    totalFee: feeCap < uncappedTotal ? feeCap : uncappedTotal,
    feeByMarket,
  };
}

export const useSmartRebalance = (groupedPosition: GroupedPosition, plan: SmartRebalancePlan | null, onSuccess?: () => void) => {
  const { address: account } = useConnection();
  const { batchAddUserMarkets } = useUserMarketsCache(account);
  const { prices: tokenPrices } = useTokenPrices([
    {
      address: groupedPosition.loanAssetAddress,
      chainId: groupedPosition.chainId,
    },
  ]);

  const totalMoved = useMemo(() => {
    if (!plan) return 0n;
    return plan.totalMoved;
  }, [plan]);

  const pricedLoanAssetUsd = useMemo(
    () => tokenPrices.get(getTokenPriceKey(groupedPosition.loanAssetAddress, groupedPosition.chainId)) ?? null,
    [groupedPosition.chainId, groupedPosition.loanAssetAddress, tokenPrices],
  );

  const feeBreakdown = useMemo(
    () => computeFeeBreakdown(plan, groupedPosition.loanAssetDecimals, pricedLoanAssetUsd),
    [groupedPosition.loanAssetDecimals, plan, pricedLoanAssetUsd],
  );

  const feeAmount = useMemo(() => {
    return feeBreakdown.totalFee;
  }, [feeBreakdown.totalFee]);

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

      const reducedAmount = delta.delta - (feeBreakdown.feeByMarket.get(market.uniqueKey) ?? 0n);
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
  }, [account, feeBreakdown.feeByMarket, groupedPosition.markets, plan]);

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
