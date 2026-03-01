import { Market as BlueMarket, MarketParams as BlueMarketParams } from '@morpho-org/blue-sdk';
import morphoABI from '@/abis/morpho';
import { getMorphoAddress } from '@/utils/morpho';
import { getClient } from '@/utils/rpc';
import { convertApyToApr } from '@/utils/rateMath';
import type { SupportedNetworks } from '@/utils/networks';
import type { GroupedPosition, Market } from './types';
import { formatBalance, formatReadable } from './balance';

// --- Config ---

const MAX_ROUNDS = 50;
const LOG_TAG = '[smart-rebalance]';
const DUST_AMOUNT = 1000n; // Leave dust in markets to not remove them from future rebalances
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}

// --- Types ---

type MarketEntry = {
  uniqueKey: string;
  originalMarket: Market;
  collateralSymbol: string;
  /** Live on-chain BlueMarket snapshot (immutable baseline) */
  baselineMarket: BlueMarket;
  /** Current user supply in this market (live, immutable) */
  currentSupply: bigint;
  /** Max we can withdraw (min of user supply and market liquidity) */
  maxWithdrawable: bigint;
};

export type MarketDelta = {
  market: Market;
  currentAmount: bigint;
  targetAmount: bigint;
  delta: bigint;
  currentApy: number;
  projectedApy: number;
  currentUtilization: number;
  projectedUtilization: number;
  collateralSymbol: string;
};

export type SmartRebalanceResult = {
  deltas: MarketDelta[];
  totalPool: bigint;
  currentWeightedApy: number;
  projectedWeightedApy: number;
  loanAssetSymbol: string;
  loanAssetDecimals: number;
};

// --- Helpers ---

function utilizationOf(market: BlueMarket): number {
  return Number(market.utilization) / 1e18;
}

/**
 * Compute weighted APY across all markets given allocations and simulated market states.
 * Uses raw bigint amounts as weights so we don't lose precision.
 */
function weightedApy(entries: MarketEntry[], allocations: Map<string, bigint>, marketMap: Map<string, BlueMarket>): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const entry of entries) {
    const amount = Number(allocations.get(entry.uniqueKey) ?? 0n);
    if (amount <= 0) continue;
    const market = marketMap.get(entry.uniqueKey);
    if (!market) continue;
    weightedSum += amount * market.supplyApy;
    totalWeight += amount;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// --- Main ---

export async function calculateSmartRebalance(
  groupedPosition: GroupedPosition,
  chainId: SupportedNetworks,
  excludedMarketIds?: Set<string>,
): Promise<SmartRebalanceResult | null> {
  // 1. Filter to positions with supply, excluding any blacklisted markets
  const positions = groupedPosition.markets.filter((pos) => {
    if (BigInt(pos.state.supplyAssets) <= 0n) return false;
    if (excludedMarketIds?.has(pos.market.uniqueKey)) return false;
    return true;
  });

  if (positions.length === 0) return null;

  // 2. Fetch fresh on-chain market state via multicall
  const client = getClient(chainId);
  const morphoAddress = getMorphoAddress(chainId);

  const results = await client.multicall({
    contracts: positions.map((pos) => ({
      address: morphoAddress as `0x${string}`,
      abi: morphoABI,
      functionName: 'market' as const,
      args: [pos.market.uniqueKey as `0x${string}`],
    })),
    allowFailure: true,
  });

  // 3. Build MarketEntry objects from live on-chain data
  const entries: MarketEntry[] = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const result = results[i];

    if (result.status !== 'success' || !result.result) {
      console.warn(`${LOG_TAG} Failed to fetch on-chain state for ${pos.market.uniqueKey}, skipping`);
      continue;
    }

    const data = result.result as readonly bigint[];
    const [totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee] = data;

    const params = new BlueMarketParams({
      loanToken: pos.market.loanAsset.address as `0x${string}`,
      collateralToken: pos.market.collateralAsset.address as `0x${string}`,
      oracle: pos.market.oracleAddress as `0x${string}`,
      irm: pos.market.irmAddress as `0x${string}`,
      lltv: BigInt(pos.market.lltv),
    });

    const baselineMarket = new BlueMarket({
      params,
      totalSupplyAssets,
      totalBorrowAssets,
      totalSupplyShares,
      totalBorrowShares,
      lastUpdate,
      fee,
      rateAtTarget: BigInt(pos.market.state.rateAtTarget),
    });

    const userSupply = BigInt(pos.state.supplyAssets);
    const liquidity = baselineMarket.liquidity;
    // Leave DUST_AMOUNT in each market so the position persists for future rebalances
    const maxFromUser = userSupply > DUST_AMOUNT ? userSupply - DUST_AMOUNT : 0n;
    const maxWithdrawable = maxFromUser < liquidity ? maxFromUser : liquidity;

    entries.push({
      uniqueKey: pos.market.uniqueKey,
      originalMarket: pos.market,
      collateralSymbol: pos.market.collateralAsset?.symbol ?? 'N/A',
      baselineMarket,
      currentSupply: userSupply,
      maxWithdrawable,
    });
  }

  if (entries.length === 0) return null;

  // 4. Compute total moveable capital
  let totalMoveable = 0n;
  for (const e of entries) totalMoveable += e.maxWithdrawable;
  if (totalMoveable === 0n) return null;

  // 5. Initialize working state
  //    - `allocations` tracks the target amount per market (starts as current)
  //    - `simMarketMap` tracks the simulated BlueMarket state reflecting moves
  const allocations = new Map<string, bigint>();
  const simMarketMap = new Map<string, BlueMarket>();

  for (const entry of entries) {
    allocations.set(entry.uniqueKey, entry.currentSupply);
    simMarketMap.set(entry.uniqueKey, entry.baselineMarket);
  }

  // Log initial state
  debugLog(`${LOG_TAG} totalMoveable=${totalMoveable}, maxRounds=${MAX_ROUNDS}, markets=${entries.length}`);
  for (const e of entries) {
    const sim = simMarketMap.get(e.uniqueKey);
    debugLog(`  ${e.collateralSymbol}: supply=${e.currentSupply}, withdrawable=${e.maxWithdrawable}, apy=${sim ? (sim.supplyApy * 100).toFixed(4) : '?'}%`);
  }

  // 6. Multi-scale optimizer: for each (src→dst) pair, evaluate multiple transfer
  //    sizes to capture non-linear APY spikes (e.g. utilization approaching 100%).
  //    The old chunk-by-chunk greedy approach missed large beneficial moves because
  //    each small step looked worse individually.

  /**
   * Simulate moving `amount` from src to dst and return
   * the resulting weighted APY without mutating state.
   */
  function evaluateMove(
    src: number,
    dst: number,
    amount: bigint,
  ): { apy: number; srcMarket: BlueMarket; dstMarket: BlueMarket } {
    const srcKey = entries[src].uniqueKey;
    const dstKey = entries[dst].uniqueKey;
    const srcSim = simMarketMap.get(srcKey)!;
    const dstSim = simMarketMap.get(dstKey)!;

    // Simulate cumulative withdrawal/supply from current sim state
    const srcAfter = srcSim.withdraw(amount, 0n).market;
    const dstAfter = dstSim.supply(amount, 0n).market;

    // Temporarily apply
    simMarketMap.set(srcKey, srcAfter);
    simMarketMap.set(dstKey, dstAfter);

    const prevSrcAlloc = allocations.get(srcKey) ?? 0n;
    const prevDstAlloc = allocations.get(dstKey) ?? 0n;
    allocations.set(srcKey, prevSrcAlloc - amount);
    allocations.set(dstKey, prevDstAlloc + amount);

    const apy = weightedApy(entries, allocations, simMarketMap);

    // Revert
    simMarketMap.set(srcKey, srcSim);
    simMarketMap.set(dstKey, dstSim);
    allocations.set(srcKey, prevSrcAlloc);
    allocations.set(dstKey, prevDstAlloc);

    return { apy, srcMarket: srcAfter, dstMarket: dstAfter };
  }

  // Transfer size fractions as rational pairs [numerator, denominator] for BigInt precision
  const FRACTION_RATIONALS: [bigint, bigint][] = [
    [2n, 100n], [5n, 100n], [10n, 100n], [15n, 100n], [20n, 100n],
    [30n, 100n], [40n, 100n], [50n, 100n], [60n, 100n], [70n, 100n],
    [80n, 100n], [90n, 100n], [1n, 1n],
  ];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const currentApy = weightedApy(entries, allocations, simMarketMap);

    let bestSrc = -1;
    let bestDst = -1;
    let bestAmount = 0n;
    let bestApy = currentApy;
    let bestSrcMarket: BlueMarket | null = null;
    let bestDstMarket: BlueMarket | null = null;

    for (let src = 0; src < entries.length; src++) {
      const srcKey = entries[src].uniqueKey;
      const srcAlloc = allocations.get(srcKey) ?? 0n;

      // How much can we still withdraw from this source?
      const alreadyWithdrawn = entries[src].currentSupply - srcAlloc;
      const remainingWithdrawable = entries[src].maxWithdrawable - alreadyWithdrawn;
      if (remainingWithdrawable <= 0n) continue;

      // Also can't withdraw more than current allocation (minus dust)
      const maxFromAlloc = srcAlloc > DUST_AMOUNT ? srcAlloc - DUST_AMOUNT : 0n;
      const maxMove = remainingWithdrawable < maxFromAlloc ? remainingWithdrawable : maxFromAlloc;
      if (maxMove <= 0n) continue;

      for (let dst = 0; dst < entries.length; dst++) {
        if (dst === src) continue;

        // Evaluate multiple transfer sizes for this pair
        for (const [num, den] of FRACTION_RATIONALS) {
          let amount = (maxMove * num) / den;
          if (amount <= 0n) continue;
          if (amount > maxMove) amount = maxMove;

          const result = evaluateMove(src, dst, amount);
          if (result.apy > bestApy) {
            bestApy = result.apy;
            bestSrc = src;
            bestDst = dst;
            bestAmount = amount;
            bestSrcMarket = result.srcMarket;
            bestDstMarket = result.dstMarket;
          }
        }
      }
    }

    // No move improves weighted APY — converged
    if (bestSrc === -1 || !bestSrcMarket || !bestDstMarket) {
      debugLog(`${LOG_TAG} round ${round}: converged. weighted APY=${(currentApy * 100).toFixed(6)}%`);
      break;
    }

    // Apply the best move
    const srcKey = entries[bestSrc].uniqueKey;
    const dstKey = entries[bestDst].uniqueKey;

    simMarketMap.set(srcKey, bestSrcMarket);
    simMarketMap.set(dstKey, bestDstMarket);
    allocations.set(srcKey, (allocations.get(srcKey) ?? 0n) - bestAmount);
    allocations.set(dstKey, (allocations.get(dstKey) ?? 0n) + bestAmount);

    debugLog(
      `${LOG_TAG} round ${round}: ${entries[bestSrc].collateralSymbol}→${entries[bestDst].collateralSymbol} ` +
      `amount=${bestAmount} | weighted APY: ${(currentApy * 100).toFixed(6)}%→${(bestApy * 100).toFixed(6)}%`,
    );
  }

  // 8. Build result deltas
  const deltas: MarketDelta[] = entries.map((entry) => {
    const current = entry.currentSupply;
    const target = allocations.get(entry.uniqueKey) ?? 0n;
    const simMarket = simMarketMap.get(entry.uniqueKey);

    return {
      market: entry.originalMarket,
      currentAmount: current,
      targetAmount: target,
      delta: target - current,
      currentApy: entry.baselineMarket.supplyApy,
      projectedApy: simMarket?.supplyApy ?? entry.baselineMarket.supplyApy,
      currentUtilization: utilizationOf(entry.baselineMarket),
      projectedUtilization: simMarket ? utilizationOf(simMarket) : utilizationOf(entry.baselineMarket),
      collateralSymbol: entry.collateralSymbol,
    };
  });

  const totalPool = deltas.reduce((sum, d) => sum + d.currentAmount, 0n);

  const currentWeightedApy =
    totalPool > 0n
      ? deltas.reduce((sum, d) => sum + Number(d.currentAmount) * d.currentApy, 0) / Number(totalPool)
      : 0;

  const projectedWeightedApy =
    totalPool > 0n
      ? deltas.reduce((sum, d) => sum + Number(d.targetAmount) * d.projectedApy, 0) / Number(totalPool)
      : 0;

  return {
    deltas: deltas.sort((a, b) => (b.delta > a.delta ? 1 : b.delta < a.delta ? -1 : 0)),
    totalPool,
    currentWeightedApy,
    projectedWeightedApy,
    loanAssetSymbol: groupedPosition.loanAssetSymbol,
    loanAssetDecimals: groupedPosition.loanAssetDecimals,
  };
}

// --- Logging ---

export function logSmartRebalanceResults(result: SmartRebalanceResult): void {
  if (!DEBUG) return;

  const { deltas, totalPool, currentWeightedApy, projectedWeightedApy, loanAssetSymbol, loanAssetDecimals } = result;

  const fmt = (val: bigint) => formatReadable(formatBalance(val, loanAssetDecimals));
  const fmtApr = (apy: number) => `${(convertApyToApr(apy) * 100).toFixed(2)}%`;
  const fmtUtil = (u: number) => `${(u * 100).toFixed(1)}%`;

  debugLog('\n=== Smart Rebalance Results (fresh on-chain data) ===');
  debugLog(`Asset: ${loanAssetSymbol}  |  Total: ${fmt(totalPool)} ${loanAssetSymbol}`);
  debugLog('');

  if (DEBUG) {
    console.table(
      deltas.map((d) => ({
        Collateral: d.collateralSymbol,
        Current: `${fmt(d.currentAmount)} ${loanAssetSymbol}`,
        Target: `${fmt(d.targetAmount)} ${loanAssetSymbol}`,
        Delta: `${Number(d.delta) >= 0 ? '+' : ''}${fmt(d.delta)} ${loanAssetSymbol}`,
        'Util Now': fmtUtil(d.currentUtilization),
        'Util After': fmtUtil(d.projectedUtilization),
        'APR Now': fmtApr(d.currentApy),
        'APR After': fmtApr(d.projectedApy),
        'Market ID': `${d.market.uniqueKey.slice(0, 10)}...`,
      })),
    );
  }

  debugLog('');
  const currentApr = convertApyToApr(currentWeightedApy);
  const projectedApr = convertApyToApr(projectedWeightedApy);
  const aprDiff = projectedApr - currentApr;
  debugLog(`Weighted APR: ${fmtApr(currentWeightedApy)} → ${fmtApr(projectedWeightedApy)}  (${aprDiff >= 0 ? '+' : ''}${(aprDiff * 100).toFixed(4)}%)`);
  debugLog('================================\n');
}
