import type { Market as BlueMarket } from '@morpho-org/blue-sdk';
import type { SmartRebalanceConstraintMap, SmartRebalanceDelta, SmartRebalanceEngineInput, SmartRebalanceEngineOutput } from './types';

const DEFAULT_MAX_ROUNDS = 50;
const DEFAULT_FRACTIONS: [bigint, bigint][] = [
  [2n, 100n],
  [5n, 100n],
  [10n, 100n],
  [15n, 100n],
  [20n, 100n],
  [30n, 100n],
  [40n, 100n],
  [50n, 100n],
  [60n, 100n],
  [70n, 100n],
  [80n, 100n],
  [90n, 100n],
  [1n, 1n],
];
const APY_SCALE = 1_000_000_000_000n;

function utilizationOf(market: BlueMarket): number {
  return Number(market.utilization) / 1e18;
}

function clampBps(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value <= 0) return 0;
  if (value >= 10_000) return 10_000;
  return Math.floor(value);
}

function toApyScaled(apy: number): bigint {
  if (!Number.isFinite(apy)) return 0n;
  return BigInt(Math.round(apy * Number(APY_SCALE)));
}

function computeObjective(uniqueKeys: string[], allocations: Map<string, bigint>, marketMap: Map<string, BlueMarket>): bigint {
  let objective = 0n;

  for (const uniqueKey of uniqueKeys) {
    const amount = allocations.get(uniqueKey) ?? 0n;
    if (amount <= 0n) continue;

    const market = marketMap.get(uniqueKey);
    if (!market) continue;

    objective += amount * toApyScaled(market.supplyApy);
  }

  return objective;
}

function objectiveToWeightedApy(objective: bigint, totalPool: bigint): number {
  if (totalPool <= 0n) return 0;
  const scaled = objective / totalPool;
  return Number(scaled) / Number(APY_SCALE);
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function resolveMaxAllocation(
  uniqueKey: string,
  totalPool: bigint,
  constraints: SmartRebalanceConstraintMap | undefined,
): bigint | undefined {
  const raw = constraints?.[uniqueKey]?.maxAllocationBps;
  const maxBps = clampBps(raw);
  if (maxBps === undefined || maxBps >= 10_000) return undefined;
  return (totalPool * BigInt(maxBps)) / 10_000n;
}

/**
 * Pure smart-rebalance optimizer.
 *
 * Input:
 * - Fresh market snapshots (BlueMarket)
 * - Current user allocation + withdrawable limits
 * - Optional per-market max-allocation constraints
 *
 * Output:
 * - Final target allocation and per-market deltas
 * - Weighted APY before/after optimization
 */
export function optimizeSmartRebalance(input: SmartRebalanceEngineInput): SmartRebalanceEngineOutput | null {
  const { entries, constraints } = input;
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const fractions = input.fractionRationals ?? DEFAULT_FRACTIONS;

  if (entries.length === 0) return null;

  const totalPool = entries.reduce((sum, entry) => sum + entry.currentSupply, 0n);
  if (totalPool <= 0n) return null;

  const uniqueKeys = entries.map((entry) => entry.uniqueKey);
  const allocations = new Map(entries.map((entry) => [entry.uniqueKey, entry.currentSupply]));
  const simMarketMap = new Map(entries.map((entry) => [entry.uniqueKey, entry.baselineMarket]));

  const maxWithdrawableMap = new Map(entries.map((entry) => [entry.uniqueKey, entry.maxWithdrawable]));
  const maxAllocationMap = new Map(
    entries.map((entry) => [entry.uniqueKey, resolveMaxAllocation(entry.uniqueKey, totalPool, constraints)]),
  );

  // First enforce hard allocation limits before objective-driven optimization.
  // This guarantees constraints like 0% are respected whenever capacity/liquidity allows.
  for (const srcEntry of entries) {
    const srcKey = srcEntry.uniqueKey;
    const srcCap = maxAllocationMap.get(srcKey);

    if (srcCap === undefined) continue;

    while (true) {
      const srcAlloc = allocations.get(srcKey) ?? 0n;
      if (srcAlloc <= srcCap) break;

      const alreadyWithdrawn = srcEntry.currentSupply - srcAlloc;
      const remainingWithdrawable = (maxWithdrawableMap.get(srcKey) ?? 0n) - alreadyWithdrawn;
      if (remainingWithdrawable <= 0n) break;

      const requiredOut = srcAlloc - srcCap;
      const maxAmount = minBigInt(requiredOut, remainingWithdrawable);
      if (maxAmount <= 0n) break;

      const srcSim = simMarketMap.get(srcKey);
      if (!srcSim) break;

      let bestDstKey: string | null = null;
      let bestAmount = 0n;
      let bestObjective: bigint | null = null;
      let bestSrcMarket: BlueMarket | null = null;
      let bestDstMarket: BlueMarket | null = null;

      for (const dstEntry of entries) {
        const dstKey = dstEntry.uniqueKey;
        if (dstKey === srcKey) continue;

        const dstSim = simMarketMap.get(dstKey);
        if (!dstSim) continue;

        const dstAlloc = allocations.get(dstKey) ?? 0n;
        const dstCap = maxAllocationMap.get(dstKey);
        const room = dstCap === undefined ? maxAmount : dstCap - dstAlloc;
        if (room <= 0n) continue;

        const amount = minBigInt(maxAmount, room);
        if (amount <= 0n) continue;

        let srcAfter: BlueMarket;
        let dstAfter: BlueMarket;

        try {
          srcAfter = srcSim.withdraw(amount, 0n).market;
          dstAfter = dstSim.supply(amount, 0n).market;
        } catch {
          continue;
        }

        simMarketMap.set(srcKey, srcAfter);
        simMarketMap.set(dstKey, dstAfter);
        allocations.set(srcKey, srcAlloc - amount);
        allocations.set(dstKey, dstAlloc + amount);

        const objective = computeObjective(uniqueKeys, allocations, simMarketMap);

        simMarketMap.set(srcKey, srcSim);
        simMarketMap.set(dstKey, dstSim);
        allocations.set(srcKey, srcAlloc);
        allocations.set(dstKey, dstAlloc);

        if (bestObjective === null || objective > bestObjective) {
          bestObjective = objective;
          bestDstKey = dstKey;
          bestAmount = amount;
          bestSrcMarket = srcAfter;
          bestDstMarket = dstAfter;
        }
      }

      if (!bestDstKey || !bestSrcMarket || !bestDstMarket || bestAmount <= 0n) {
        break;
      }

      const dstAlloc = allocations.get(bestDstKey) ?? 0n;
      allocations.set(srcKey, srcAlloc - bestAmount);
      allocations.set(bestDstKey, dstAlloc + bestAmount);
      simMarketMap.set(srcKey, bestSrcMarket);
      simMarketMap.set(bestDstKey, bestDstMarket);
    }
  }

  for (let round = 0; round < maxRounds; round++) {
    const currentObjective = computeObjective(uniqueKeys, allocations, simMarketMap);

    let bestSrcKey: string | null = null;
    let bestDstKey: string | null = null;
    let bestAmount = 0n;
    let bestObjective = currentObjective;
    let bestSrcMarket: BlueMarket | null = null;
    let bestDstMarket: BlueMarket | null = null;

    for (const srcEntry of entries) {
      const srcKey = srcEntry.uniqueKey;
      const srcAlloc = allocations.get(srcKey) ?? 0n;
      const alreadyWithdrawn = srcEntry.currentSupply - srcAlloc;
      const remainingWithdrawable = (maxWithdrawableMap.get(srcKey) ?? 0n) - alreadyWithdrawn;
      if (remainingWithdrawable <= 0n) continue;

      const maxMove = remainingWithdrawable < srcAlloc ? remainingWithdrawable : srcAlloc;
      if (maxMove <= 0n) continue;

      const srcSim = simMarketMap.get(srcKey);
      if (!srcSim) continue;

      for (const dstEntry of entries) {
        const dstKey = dstEntry.uniqueKey;
        if (dstKey === srcKey) continue;

        const dstSim = simMarketMap.get(dstKey);
        if (!dstSim) continue;

        const dstAlloc = allocations.get(dstKey) ?? 0n;
        const dstCap = maxAllocationMap.get(dstKey);

        if (dstCap !== undefined && dstAlloc >= dstCap) continue;

        for (const [num, den] of fractions) {
          let amount = (maxMove * num) / den;
          if (amount <= 0n) continue;
          if (amount > maxMove) amount = maxMove;

          if (dstCap !== undefined) {
            const room = dstCap - dstAlloc;
            if (room <= 0n) continue;
            if (amount > room) amount = room;
            if (amount <= 0n) continue;
          }

          let srcAfter: BlueMarket;
          let dstAfter: BlueMarket;

          try {
            srcAfter = srcSim.withdraw(amount, 0n).market;
            dstAfter = dstSim.supply(amount, 0n).market;
          } catch {
            continue;
          }

          simMarketMap.set(srcKey, srcAfter);
          simMarketMap.set(dstKey, dstAfter);
          allocations.set(srcKey, srcAlloc - amount);
          allocations.set(dstKey, dstAlloc + amount);

          const objective = computeObjective(uniqueKeys, allocations, simMarketMap);

          simMarketMap.set(srcKey, srcSim);
          simMarketMap.set(dstKey, dstSim);
          allocations.set(srcKey, srcAlloc);
          allocations.set(dstKey, dstAlloc);

          if (objective > bestObjective) {
            bestObjective = objective;
            bestSrcKey = srcKey;
            bestDstKey = dstKey;
            bestAmount = amount;
            bestSrcMarket = srcAfter;
            bestDstMarket = dstAfter;
          }
        }
      }
    }

    if (!bestSrcKey || !bestDstKey || !bestSrcMarket || !bestDstMarket || bestAmount <= 0n) {
      break;
    }

    simMarketMap.set(bestSrcKey, bestSrcMarket);
    simMarketMap.set(bestDstKey, bestDstMarket);
    allocations.set(bestSrcKey, (allocations.get(bestSrcKey) ?? 0n) - bestAmount);
    allocations.set(bestDstKey, (allocations.get(bestDstKey) ?? 0n) + bestAmount);
  }

  const deltas: SmartRebalanceDelta[] = entries.map((entry) => {
    const currentAmount = entry.currentSupply;
    const targetAmount = allocations.get(entry.uniqueKey) ?? 0n;
    const projectedMarket = simMarketMap.get(entry.uniqueKey) ?? entry.baselineMarket;

    return {
      market: entry.market,
      currentAmount,
      targetAmount,
      delta: targetAmount - currentAmount,
      currentApy: entry.baselineMarket.supplyApy,
      projectedApy: projectedMarket.supplyApy,
      currentUtilization: utilizationOf(entry.baselineMarket),
      projectedUtilization: utilizationOf(projectedMarket),
      collateralSymbol: entry.market.collateralAsset?.symbol ?? 'N/A',
    };
  });

  const currentObjective = computeObjective(
    uniqueKeys,
    new Map(entries.map((entry) => [entry.uniqueKey, entry.currentSupply])),
    new Map(entries.map((entry) => [entry.uniqueKey, entry.baselineMarket])),
  );
  const projectedObjective = computeObjective(uniqueKeys, allocations, simMarketMap);

  const totalMoved = deltas.reduce((sum, delta) => {
    if (delta.delta < 0n) return sum + -delta.delta;
    return sum;
  }, 0n);

  return {
    deltas: deltas.sort((a, b) => {
      if (b.delta > a.delta) return 1;
      if (b.delta < a.delta) return -1;
      return 0;
    }),
    totalPool,
    currentWeightedApy: objectiveToWeightedApy(currentObjective, totalPool),
    projectedWeightedApy: objectiveToWeightedApy(projectedObjective, totalPool),
    totalMoved,
  };
}
