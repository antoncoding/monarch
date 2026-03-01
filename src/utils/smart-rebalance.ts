import { formatUnits } from 'viem';
import type { GroupedPosition, Market, MarketPositionWithEarnings } from './types';
import { previewMarketState } from './morpho';
import { formatBalance, formatReadable } from './balance';

const ALLOCATION_ROUNDS = 20;

type MarketDelta = {
  market: Market;
  currentAmount: bigint;
  targetAmount: bigint;
  delta: bigint;
  lockedAmount: bigint;
  currentApy: number;
  projectedApy: number;
  collateralSymbol: string;
};

type SmartRebalanceResult = {
  deltas: MarketDelta[];
  totalRebalanceable: bigint;
  totalAssets: bigint;
  currentWeightedApy: number;
  projectedWeightedApy: number;
  loanAssetSymbol: string;
  loanAssetDecimals: number;
};

type ClonedMarketState = {
  supplyAssets: string;
  borrowAssets: string;
  supplyShares: string;
  borrowShares: string;
  liquidityAssets: string;
  supplyApy: number;
  borrowApy: number;
  utilization: number;
  fee: number;
  timestamp: number;
  rateAtTarget: string;
  supplyAssetsUsd: number;
  borrowAssetsUsd: number;
  liquidityAssetsUsd: number;
  collateralAssets: string;
  collateralAssetsUsd: number | null;
  apyAtTarget: number;
  dailySupplyApy: number | null;
  dailyBorrowApy: number | null;
  weeklySupplyApy: number | null;
  weeklyBorrowApy: number | null;
  monthlySupplyApy: number | null;
  monthlyBorrowApy: number | null;
};

function deepCloneMarket(market: Market): Market {
  return {
    ...market,
    state: { ...market.state },
  };
}

function applyPreviewToMarket(
  market: Market,
  preview: { supplyApy: number; borrowApy: number; utilization: number; totalSupplyAssets: bigint; totalBorrowAssets: bigint; liquidityAssets: bigint },
): void {
  market.state.supplyApy = preview.supplyApy;
  market.state.borrowApy = preview.borrowApy;
  market.state.utilization = preview.utilization;
  market.state.supplyAssets = preview.totalSupplyAssets.toString();
  market.state.borrowAssets = preview.totalBorrowAssets.toString();
  market.state.liquidityAssets = preview.liquidityAssets.toString();
}

export function calculateSmartRebalance(
  groupedPosition: GroupedPosition,
  excludedMarketIds?: Set<string>,
): SmartRebalanceResult | null {
  const decimals = groupedPosition.loanAssetDecimals;

  // 1. Filter markets: keep positions with supply > 0, remove excluded
  const eligiblePositions = groupedPosition.markets.filter((pos) => {
    if (BigInt(pos.state.supplyAssets) <= 0n) return false;
    if (excludedMarketIds?.has(pos.market.uniqueKey)) return false;
    return true;
  });

  if (eligiblePositions.length === 0) return null;

  // 2. Determine locked amounts and withdrawable portions
  const positionData = eligiblePositions.map((pos) => {
    const userSupply = BigInt(pos.state.supplyAssets);
    const marketLiquidity = BigInt(pos.market.state.liquidityAssets);
    const locked = userSupply > marketLiquidity ? userSupply - marketLiquidity : 0n;
    const withdrawable = userSupply - locked;
    return { position: pos, userSupply, locked, withdrawable };
  });

  const totalAssets = positionData.reduce((sum, d) => sum + d.userSupply, 0n);
  const totalRebalanceable = positionData.reduce((sum, d) => sum + d.withdrawable, 0n);

  if (totalRebalanceable === 0n) return null;

  // 3. Clone markets and simulate withdrawing our capital to get baseline state
  const clonedMarkets = new Map<string, Market>();
  for (const { position, withdrawable } of positionData) {
    const clone = deepCloneMarket(position.market);
    if (withdrawable > 0n) {
      const preview = previewMarketState(clone, -withdrawable);
      if (preview) {
        applyPreviewToMarket(clone, preview);
      }
    }
    clonedMarkets.set(clone.uniqueKey, clone);
  }

  // 4. Greedy allocation loop
  // Start with locked amounts pre-seeded
  const allocations = new Map<string, bigint>();
  for (const { position, locked } of positionData) {
    allocations.set(position.market.uniqueKey, locked);
  }

  const chunk = totalRebalanceable / BigInt(ALLOCATION_ROUNDS);
  if (chunk === 0n) return null;

  for (let round = 0; round < ALLOCATION_ROUNDS; round++) {
    const isLastRound = round === ALLOCATION_ROUNDS - 1;
    // On last round, allocate remaining to avoid rounding dust
    const allocated = chunk * BigInt(round);
    const roundAmount = isLastRound ? totalRebalanceable - allocated : chunk;

    let bestMarketKey: string | null = null;
    let bestApy = -Infinity;

    for (const [key, clone] of clonedMarkets) {
      const preview = previewMarketState(clone, roundAmount);
      if (!preview) continue;
      if (preview.supplyApy > bestApy) {
        bestApy = preview.supplyApy;
        bestMarketKey = key;
      }
    }

    if (!bestMarketKey) break;

    // Allocate to best market
    allocations.set(bestMarketKey, (allocations.get(bestMarketKey) ?? 0n) + roundAmount);

    // Update the cloned market state
    const clone = clonedMarkets.get(bestMarketKey)!;
    const preview = previewMarketState(clone, roundAmount);
    if (preview) {
      applyPreviewToMarket(clone, preview);
    }
  }

  // 5. Build deltas
  const deltas: MarketDelta[] = positionData.map(({ position, userSupply, locked }) => {
    const targetAmount = allocations.get(position.market.uniqueKey) ?? 0n;
    const delta = targetAmount - userSupply;

    // Get projected APY by simulating the target supply on a fresh clone
    const freshClone = deepCloneMarket(position.market);
    // Withdraw our current supply first
    const withdrawPreview = previewMarketState(freshClone, -userSupply);
    let projectedApy = position.market.state.supplyApy;
    if (withdrawPreview && targetAmount > 0n) {
      applyPreviewToMarket(freshClone, withdrawPreview);
      const supplyPreview = previewMarketState(freshClone, targetAmount);
      if (supplyPreview) {
        projectedApy = supplyPreview.supplyApy;
      }
    }

    return {
      market: position.market,
      currentAmount: userSupply,
      targetAmount,
      delta,
      lockedAmount: locked,
      currentApy: position.market.state.supplyApy,
      projectedApy,
      collateralSymbol: position.market.collateralAsset?.symbol ?? 'N/A',
    };
  });

  // Calculate weighted APYs
  const currentWeightedApy =
    totalAssets > 0n
      ? deltas.reduce((sum, d) => sum + Number(d.currentAmount) * d.currentApy, 0) / Number(totalAssets)
      : 0;

  const projectedWeightedApy =
    totalAssets > 0n
      ? deltas.reduce((sum, d) => sum + Number(d.targetAmount) * d.projectedApy, 0) / Number(totalAssets)
      : 0;

  return {
    deltas: deltas.sort((a, b) => Number(b.delta - a.delta)),
    totalRebalanceable,
    totalAssets,
    currentWeightedApy,
    projectedWeightedApy,
    loanAssetSymbol: groupedPosition.loanAssetSymbol,
    loanAssetDecimals: decimals,
  };
}

export function logSmartRebalanceResults(result: SmartRebalanceResult): void {
  const { deltas, totalAssets, totalRebalanceable, currentWeightedApy, projectedWeightedApy, loanAssetSymbol, loanAssetDecimals } = result;

  const fmtAmount = (val: bigint) => formatReadable(formatBalance(val, loanAssetDecimals));
  const fmtApy = (val: number) => `${(val * 100).toFixed(2)}%`;

  console.log('\n=== Smart Rebalance Results ===');
  console.log(`Asset: ${loanAssetSymbol}`);
  console.log(`Total Assets: ${fmtAmount(totalAssets)} ${loanAssetSymbol}`);
  console.log(`Rebalanceable: ${fmtAmount(totalRebalanceable)} ${loanAssetSymbol}`);
  console.log('');

  console.table(
    deltas.map((d) => ({
      Collateral: d.collateralSymbol,
      'Current': `${fmtAmount(d.currentAmount)} ${loanAssetSymbol}`,
      'Target': `${fmtAmount(d.targetAmount)} ${loanAssetSymbol}`,
      'Delta': `${Number(d.delta) >= 0 ? '+' : ''}${fmtAmount(d.delta)} ${loanAssetSymbol}`,
      'Locked': d.lockedAmount > 0n ? `${fmtAmount(d.lockedAmount)} ${loanAssetSymbol}` : '-',
      'APY Now': fmtApy(d.currentApy),
      'APY Projected': fmtApy(d.projectedApy),
      'Market ID': `${d.market.uniqueKey.slice(0, 10)}...`,
    })),
  );

  console.log('');
  console.log(`Weighted APY: ${fmtApy(currentWeightedApy)} → ${fmtApy(projectedWeightedApy)}`);
  const apyDiff = projectedWeightedApy - currentWeightedApy;
  console.log(`APY Change: ${apyDiff >= 0 ? '+' : ''}${(apyDiff * 100).toFixed(4)}%`);
  console.log('================================\n');
}
