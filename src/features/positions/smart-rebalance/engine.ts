import type { Market as BlueMarket } from '@morpho-org/blue-sdk';
import type { SmartRebalanceConstraintMap, SmartRebalanceDelta, SmartRebalanceEngineInput, SmartRebalanceEngineOutput } from './types';

const MAX_CHUNKS = 100n;
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

function simulateWithdrawAtCap(market: BlueMarket, capAmount: bigint): { amount: bigint; marketAfter: BlueMarket } {
  if (capAmount <= 0n) {
    return { amount: 0n, marketAfter: market };
  }

  try {
    return {
      amount: capAmount,
      marketAfter: market.withdraw(capAmount, 0n).market,
    };
  } catch {
    return { amount: 0n, marketAfter: market };
  }
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

type CleanStateResult = {
  principal: bigint;
  movableKeys: string[];
  maxAllocationMap: Map<string, bigint | undefined>;
  allocations: Map<string, bigint>;
  marketMap: Map<string, BlueMarket>;
};

type ChunkAllocationState = {
  allocations: Map<string, bigint>;
  marketMap: Map<string, BlueMarket>;
};

function cleanStates(
  entries: SmartRebalanceEngineInput['entries'],
  constraints: SmartRebalanceConstraintMap | undefined,
  totalPool: bigint,
): CleanStateResult {
  const principal = 0n;
  const movableKeys: string[] = [];
  const maxAllocationMap = new Map<string, bigint | undefined>();
  const allocations = new Map<string, bigint>();
  const marketMap = new Map<string, BlueMarket>();

  let runningPrincipal = principal;

  for (const entry of entries) {
    maxAllocationMap.set(entry.uniqueKey, resolveMaxAllocation(entry.uniqueKey, totalPool, constraints));

    const cappedWithdraw = minBigInt(entry.currentSupply, entry.maxWithdrawable);
    const { amount: withdrawnAmount, marketAfter } = simulateWithdrawAtCap(entry.baselineMarket, cappedWithdraw);
    const lockedAmount = entry.currentSupply - withdrawnAmount;

    movableKeys.push(entry.uniqueKey);
    allocations.set(entry.uniqueKey, lockedAmount);
    marketMap.set(entry.uniqueKey, marketAfter);
    runningPrincipal += withdrawnAmount;
  }

  return {
    principal: runningPrincipal,
    movableKeys,
    maxAllocationMap,
    allocations,
    marketMap,
  };
}

function buildChunks(principal: bigint): bigint[] {
  if (principal <= 0n) return [];

  const chunkCount = principal < MAX_CHUNKS ? principal : MAX_CHUNKS;
  const baseChunk = principal / chunkCount;
  const remainder = principal % chunkCount;

  const chunks = Array.from({ length: Number(chunkCount) }, () => baseChunk);
  if (chunks.length > 0 && remainder > 0n) {
    chunks[chunks.length - 1] += remainder;
  }

  return chunks;
}

function findBestSupplyTarget(
  amount: bigint,
  movableKeys: string[],
  uniqueKeys: string[],
  allocations: Map<string, bigint>,
  marketMap: Map<string, BlueMarket>,
  maxAllocationMap: Map<string, bigint | undefined>,
): { uniqueKey: string; amount: bigint; marketAfter: BlueMarket; objective: bigint } | null {
  let bestKey: string | null = null;
  let bestAmount = 0n;
  let bestObjective: bigint | null = null;
  let bestMarketAfter: BlueMarket | null = null;

  for (const uniqueKey of movableKeys) {
    const market = marketMap.get(uniqueKey);
    if (!market) continue;

    const currentAllocation = allocations.get(uniqueKey) ?? 0n;
    const maxAllocation = maxAllocationMap.get(uniqueKey);
    const room = maxAllocation === undefined ? amount : maxAllocation - currentAllocation;
    if (room <= 0n) continue;

    const supplyAmount = minBigInt(amount, room);
    if (supplyAmount <= 0n) continue;

    let marketAfter: BlueMarket;
    try {
      marketAfter = market.supply(supplyAmount, 0n).market;
    } catch {
      continue;
    }

    allocations.set(uniqueKey, currentAllocation + supplyAmount);
    marketMap.set(uniqueKey, marketAfter);
    const objective = computeObjective(uniqueKeys, allocations, marketMap);
    allocations.set(uniqueKey, currentAllocation);
    marketMap.set(uniqueKey, market);

    if (bestObjective === null || objective > bestObjective) {
      bestObjective = objective;
      bestKey = uniqueKey;
      bestAmount = supplyAmount;
      bestMarketAfter = marketAfter;
    }
  }

  if (!bestKey || !bestMarketAfter || bestAmount <= 0n || bestObjective === null) {
    return null;
  }

  return { uniqueKey: bestKey, amount: bestAmount, marketAfter: bestMarketAfter, objective: bestObjective };
}

function calculateAllocation(
  chunks: bigint[],
  movableKeys: string[],
  uniqueKeys: string[],
  allocations: Map<string, bigint>,
  marketMap: Map<string, BlueMarket>,
  maxAllocationMap: Map<string, bigint | undefined>,
): ChunkAllocationState {
  for (const chunk of chunks) {
    let remainingChunk = chunk;
    if (remainingChunk <= 0n) continue;

    while (remainingChunk > 0n) {
      const best = findBestSupplyTarget(remainingChunk, movableKeys, uniqueKeys, allocations, marketMap, maxAllocationMap);
      if (!best) break;

      allocations.set(best.uniqueKey, (allocations.get(best.uniqueKey) ?? 0n) + best.amount);
      marketMap.set(best.uniqueKey, best.marketAfter);
      remainingChunk -= best.amount;
    }
  }

  return {
    allocations,
    marketMap,
  };
}

function buildDeltas(
  entries: SmartRebalanceEngineInput['entries'],
  allocations: Map<string, bigint>,
  projectedMarketMap: Map<string, BlueMarket>,
): SmartRebalanceDelta[] {
  return entries.map((entry) => {
    const currentAmount = entry.currentSupply;
    const targetAmount = allocations.get(entry.uniqueKey) ?? currentAmount;
    const projectedMarket = projectedMarketMap.get(entry.uniqueKey) ?? entry.baselineMarket;

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
}

function sumTotalMoved(deltas: SmartRebalanceDelta[]): bigint {
  return deltas.reduce((sum, delta) => {
    if (delta.delta < 0n) return sum + -delta.delta;
    return sum;
  }, 0n);
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
export function planRebalance(input: SmartRebalanceEngineInput): SmartRebalanceEngineOutput | null {
  const { entries, constraints } = input;

  if (entries.length === 0) return null;

  const totalPool = entries.reduce((sum, entry) => sum + entry.currentSupply, 0n);
  if (totalPool <= 0n) return null;

  const uniqueKeys = entries.map((entry) => entry.uniqueKey);

  // 1. Simulate extra liquidity and start state:
  //    - attempt best-effort withdrawal from each selected market
  //    - keep any non-withdrawable remainder locked in-place
  const cleaned = cleanStates(entries, constraints, totalPool);
  if (cleaned.principal <= 0n || cleaned.movableKeys.length === 0) {
    const deltas = buildDeltas(entries, cleaned.allocations, cleaned.marketMap);
    const currentObjective = computeObjective(
      uniqueKeys,
      new Map(entries.map((entry) => [entry.uniqueKey, entry.currentSupply])),
      new Map(entries.map((entry) => [entry.uniqueKey, entry.baselineMarket])),
    );
    const projectedObjective = computeObjective(uniqueKeys, cleaned.allocations, cleaned.marketMap);

    return {
      deltas: deltas.sort((a, b) => {
        if (b.delta > a.delta) return 1;
        if (b.delta < a.delta) return -1;
        return 0;
      }),
      totalPool,
      currentWeightedApy: objectiveToWeightedApy(currentObjective, totalPool),
      projectedWeightedApy: objectiveToWeightedApy(projectedObjective, totalPool),
      totalMoved: sumTotalMoved(deltas),
    };
  }

  // 2. Divide principal into up-to-100 chunks.
  const chunks = buildChunks(cleaned.principal);

  // 3. For each chunk, choose the destination that maximizes global weighted objective after that step.
  const allocated = calculateAllocation(
    chunks,
    cleaned.movableKeys,
    uniqueKeys,
    cleaned.allocations,
    cleaned.marketMap,
    cleaned.maxAllocationMap,
  );

  // 4. Compute final delta plan (withdraw from current -> deposit to final targets).
  const deltas = buildDeltas(entries, allocated.allocations, allocated.marketMap);

  const currentObjective = computeObjective(
    uniqueKeys,
    new Map(entries.map((entry) => [entry.uniqueKey, entry.currentSupply])),
    new Map(entries.map((entry) => [entry.uniqueKey, entry.baselineMarket])),
  );
  const projectedObjective = computeObjective(uniqueKeys, allocated.allocations, allocated.marketMap);

  // Reliability guard: never return a plan that is worse than the current weighted objective.
  if (projectedObjective < currentObjective) {
    const noOpAllocations = new Map(entries.map((entry) => [entry.uniqueKey, entry.currentSupply]));
    const noOpMarkets = new Map(entries.map((entry) => [entry.uniqueKey, entry.baselineMarket]));
    const noOpDeltas = buildDeltas(entries, noOpAllocations, noOpMarkets);

    return {
      deltas: noOpDeltas.sort((a, b) => {
        if (b.delta > a.delta) return 1;
        if (b.delta < a.delta) return -1;
        return 0;
      }),
      totalPool,
      currentWeightedApy: objectiveToWeightedApy(currentObjective, totalPool),
      projectedWeightedApy: objectiveToWeightedApy(currentObjective, totalPool),
      totalMoved: 0n,
    };
  }

  const totalMoved = sumTotalMoved(deltas);

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

export const optimizeSmartRebalance = planRebalance;
