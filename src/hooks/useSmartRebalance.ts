import { useCallback, useMemo } from 'react';
import { type Address, encodeFunctionData, formatUnits, maxUint256 } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { getFee, getRebalanceFee, REBALANCE_FEE_CEILING_USD } from '@/config/fees';
import { MONARCH_FEE_RECIPIENT } from '@/config/smart-rebalance';
import { getTokenPriceKey } from '@/data-sources/morpho-api/prices';
import { GAS_COSTS } from '@/features/markets/components/constants';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import type { GroupedPosition } from '@/utils/types';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import type { SmartRebalancePlan } from '@/features/positions/smart-rebalance/planner';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useRebalanceExecution, type RebalanceExecutionStepType } from './useRebalanceExecution';
import { useConnection } from 'wagmi';
import { computeAssetUsdValue } from '@/utils/assetDisplay';

const FULL_RATE_PPM = 1_000_000n;
const SMART_REBALANCE_SHARE_WITHDRAW_DUST_BUFFER = 1000n;
const DAYS_PER_YEAR = 365;

type SmartRebalanceFeeBreakdown = {
  totalFee: bigint;
  uncappedTotalFee: bigint;
  assetPriceUsd: number | null;
  feeByMarket: Map<string, bigint>;
  isReady: boolean;
};

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

function computeFeeBreakdown(
  plan: SmartRebalancePlan | null,
  loanAssetDecimals: number,
  loanAssetPriceUsd: number | null,
): SmartRebalanceFeeBreakdown {
  if (!plan) {
    return { totalFee: 0n, uncappedTotalFee: 0n, assetPriceUsd: null, feeByMarket: new Map<string, bigint>(), isReady: false };
  }

  const feeByMarket = new Map<string, bigint>();
  const baseFees: Array<{ uniqueKey: string; fee: bigint }> = [];
  let uncappedTotal = 0n;

  for (const delta of plan.deltas) {
    if (delta.delta <= 0n) continue;
    const fee = getRebalanceFee({
      amount: delta.delta,
      applyCeiling: false,
    });
    if (fee <= 0n) continue;
    baseFees.push({ uniqueKey: delta.market.uniqueKey, fee });
    uncappedTotal += fee;
  }

  if (uncappedTotal === 0n) {
    return { totalFee: 0n, uncappedTotalFee: 0n, assetPriceUsd: loanAssetPriceUsd, feeByMarket, isReady: true };
  }

  if (loanAssetPriceUsd == null || !Number.isFinite(loanAssetPriceUsd) || loanAssetPriceUsd <= 0) {
    return {
      totalFee: 0n,
      uncappedTotalFee: uncappedTotal,
      assetPriceUsd: null,
      feeByMarket: new Map<string, bigint>(),
      isReady: false,
    };
  }

  const cappedTotal = getFee({
    amount: uncappedTotal,
    ratePpm: FULL_RATE_PPM,
    ceilingUsd: REBALANCE_FEE_CEILING_USD,
    assetPriceUsd: loanAssetPriceUsd,
    assetDecimals: loanAssetDecimals,
  });

  let remainingFee = cappedTotal;
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
    totalFee: cappedTotal,
    uncappedTotalFee: uncappedTotal,
    assetPriceUsd: loanAssetPriceUsd,
    feeByMarket,
    isReady: true,
  };
}

function computeEstimatedDailyEarningsUsd(
  plan: SmartRebalancePlan | null,
  loanAssetDecimals: number,
  loanAssetPriceUsd: number | null,
): number | null {
  if (!plan || loanAssetPriceUsd == null || !Number.isFinite(loanAssetPriceUsd) || loanAssetPriceUsd <= 0) {
    return null;
  }

  const totalPoolToken = Number(formatUnits(plan.totalPool, loanAssetDecimals));
  if (!Number.isFinite(totalPoolToken) || totalPoolToken <= 0) {
    return null;
  }

  const projectedApy = plan.projectedWeightedApy;
  if (!Number.isFinite(projectedApy)) {
    return null;
  }

  const totalPoolUsd = totalPoolToken * loanAssetPriceUsd;
  const compoundedRateBase = 1 + projectedApy;
  if (!Number.isFinite(compoundedRateBase) || compoundedRateBase < 0) {
    return null;
  }

  const dailyRate = compoundedRateBase === 0 ? -1 : compoundedRateBase ** (1 / DAYS_PER_YEAR) - 1;
  if (!Number.isFinite(dailyRate)) {
    return null;
  }

  const estimatedDailyEarningsUsd = totalPoolUsd * dailyRate;
  if (!Number.isFinite(estimatedDailyEarningsUsd)) {
    return null;
  }

  return estimatedDailyEarningsUsd;
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
  const fallbackLoanAssetPriceUsd = useMemo(
    () => (plan ? deriveLoanAssetPriceUsdFromPlan(plan, groupedPosition.loanAssetDecimals) : null),
    [groupedPosition.loanAssetDecimals, plan],
  );
  const effectiveLoanAssetPriceUsd = pricedLoanAssetUsd ?? fallbackLoanAssetPriceUsd;

  const feeBreakdown = useMemo(
    () => computeFeeBreakdown(plan, groupedPosition.loanAssetDecimals, effectiveLoanAssetPriceUsd),
    [effectiveLoanAssetPriceUsd, groupedPosition.loanAssetDecimals, plan],
  );

  const feeAmount = useMemo(() => {
    if (!feeBreakdown.isReady) return null;
    return feeBreakdown.totalFee;
  }, [feeBreakdown.isReady, feeBreakdown.totalFee]);

  const feeUsdValue = useMemo(
    () => (feeAmount == null ? null : computeAssetUsdValue(feeAmount, groupedPosition.loanAssetDecimals, feeBreakdown.assetPriceUsd)),
    [feeAmount, feeBreakdown.assetPriceUsd, groupedPosition.loanAssetDecimals],
  );

  const isFeeCapped = useMemo(
    () => feeBreakdown.isReady && feeBreakdown.totalFee > 0n && feeBreakdown.uncappedTotalFee > feeBreakdown.totalFee,
    [feeBreakdown.isReady, feeBreakdown.totalFee, feeBreakdown.uncappedTotalFee],
  );

  const estimatedDailyEarningsUsd = useMemo(
    () => computeEstimatedDailyEarningsUsd(plan, groupedPosition.loanAssetDecimals, effectiveLoanAssetPriceUsd),
    [effectiveLoanAssetPriceUsd, groupedPosition.loanAssetDecimals, plan],
  );

  const transferAmountEstimate = useMemo(() => {
    if (!plan) return 0n;

    let total = 0n;
    for (const delta of plan.deltas) {
      if (delta.delta <= 0n) continue;

      const feeForMarket = feeBreakdown.feeByMarket.get(delta.market.uniqueKey) ?? 0n;
      const reducedAmount = delta.delta - feeForMarket;
      if (reducedAmount <= 0n) continue;

      total += reducedAmount + feeForMarket;
    }

    return total;
  }, [feeBreakdown.feeByMarket, plan]);

  const execution = useRebalanceExecution({
    chainId: groupedPosition.chainId,
    loanAssetAddress: groupedPosition.loanAssetAddress as Address,
    loanAssetSymbol: groupedPosition.loanAsset,
    requiredAmount: transferAmountEstimate,
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
    let transferAmount = 0n;

    for (const delta of plan.deltas) {
      if (delta.delta >= 0n) continue;

      const withdrawAmount = -delta.delta;
      const market = delta.market;
      touchedMarketKeys.add(market.uniqueKey);
      const supplyShares = BigInt(
        groupedPosition.markets.find((position) => position.market.uniqueKey === market.uniqueKey)?.state.supplyShares ?? '0',
      );
      const shouldWithdrawByShares = supplyShares > 0n && delta.targetAmount <= SMART_REBALANCE_SHARE_WITHDRAW_DUST_BUFFER;

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
            shouldWithdrawByShares ? 0n : withdrawAmount,
            shouldWithdrawByShares ? supplyShares : 0n,
            shouldWithdrawByShares ? withdrawAmount : maxUint256,
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

      const feeForMarket = feeBreakdown.feeByMarket.get(market.uniqueKey) ?? 0n;
      const reducedAmount = delta.delta - feeForMarket;
      if (reducedAmount <= 0n) continue;

      transferAmount += reducedAmount + feeForMarket;
      supplyTxs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoSupply',
          args: [marketParams, reducedAmount, 0n, 1n, account, '0x'],
        }),
      );
    }

    return { withdrawTxs, supplyTxs, allMarketKeys: [...touchedMarketKeys], transferAmount };
  }, [account, feeBreakdown.feeByMarket, groupedPosition.markets, plan]);

  const executeSmartRebalance = useCallback(
    async (summaryItems?: TransactionSummaryItem[]) => {
      if (!plan || !account || totalMoved === 0n || !feeBreakdown.isReady) {
        return false;
      }

      const { withdrawTxs, supplyTxs, allMarketKeys, transferAmount } = generateSmartRebalanceTxData();
      const isWithdrawOnly = supplyTxs.length === 0 || transferAmount === 0n;

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
              args: [groupedPosition.loanAssetAddress as Address, MONARCH_FEE_RECIPIENT, maxUint256],
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
        transferAmount: isWithdrawOnly ? 0n : transferAmount,
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
      feeBreakdown.isReady,
      plan,
      totalMoved,
    ],
  );

  return {
    executeSmartRebalance,
    isProcessing: execution.isProcessing,
    totalMoved,
    feeAmount,
    feeUsdValue,
    isFeeCapped,
    isFeeReady: feeBreakdown.isReady,
    estimatedDailyEarningsUsd,
    transaction: execution.transaction,
    dismiss: execution.dismiss,
    currentStep: execution.currentStep as RebalanceExecutionStepType | null,
  };
};
