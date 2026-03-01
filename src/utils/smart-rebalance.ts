import { Market as BlueMarket, MarketParams as BlueMarketParams } from '@morpho-org/blue-sdk';
import morphoABI from '@/abis/morpho';
import { getMorphoAddress } from '@/utils/morpho';
import { getClient } from '@/utils/rpc';
import type { SupportedNetworks } from '@/utils/networks';
import type { GroupedPosition, Market } from './types';
import { formatBalance, formatReadable } from './balance';

// --- Config ---

const MAX_ROUNDS = 10_000;
const LOG_TAG = '[smart-rebalance]';

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

function apyToApr(apy: number): number {
  if (apy <= 0) return 0;
  return Math.log(1 + apy);
}

function utilizationOf(market: BlueMarket): number {
  return Number(market.utilization) / 1e18;
}

/**
 * Compute weighted APY across all markets given allocations and simulated market states.
 * Uses raw bigint amounts as weights so we don't lose precision.
 */
function weightedApy(entries: MarketEntry[], allocations: Map<string, bigint>, markets: BlueMarket[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < entries.length; i++) {
    const amount = Number(allocations.get(entries[i].uniqueKey) ?? 0n);
    weightedSum += amount * markets[i].supplyApy;
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
    const maxWithdrawable = userSupply < liquidity ? userSupply : liquidity;

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

  // 5. Determine chunk size: 1% of portfolio, capped at $10 worth
  const dollarCap = 10n * 10n ** BigInt(groupedPosition.loanAssetDecimals);
  const onePercent = totalMoveable / 100n;
  const chunk = onePercent < dollarCap ? onePercent : dollarCap;
  if (chunk === 0n) return null;

  // 6. Initialize working state
  //    - `allocations` tracks the target amount per market (starts as current)
  //    - `simMarkets` tracks the simulated BlueMarket state reflecting moves
  const allocations = new Map<string, bigint>();
  const simMarkets: BlueMarket[] = [];

  for (const entry of entries) {
    allocations.set(entry.uniqueKey, entry.currentSupply);
    simMarkets.push(entry.baselineMarket);
  }

  // Log initial state
  console.log(`${LOG_TAG} chunk=${chunk}, totalMoveable=${totalMoveable}, maxRounds=${MAX_ROUNDS}, markets=${entries.length}`);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    console.log(`  ${e.collateralSymbol}: supply=${e.currentSupply}, withdrawable=${e.maxWithdrawable}, apy=${(simMarkets[i].supplyApy * 100).toFixed(4)}%`);
  }

  // 7. Greedy hill-climb: try every (src→dst) move of `chunk`, keep the best one per round
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const currentApy = weightedApy(entries, allocations, simMarkets);

    let bestSrc = -1;
    let bestDst = -1;
    let bestApy = currentApy;
    let bestSrcMarket: BlueMarket | null = null;
    let bestDstMarket: BlueMarket | null = null;

    for (let src = 0; src < entries.length; src++) {
      const srcKey = entries[src].uniqueKey;
      const srcAlloc = allocations.get(srcKey)!;

      // Can't withdraw more than allocated
      if (srcAlloc < chunk) continue;

      // Can't withdraw more than what's actually withdrawable from the original position
      const alreadyWithdrawn = entries[src].currentSupply - srcAlloc;
      if (alreadyWithdrawn + chunk > entries[src].maxWithdrawable) continue;

      // Simulate withdrawal from source
      const srcAfter = simMarkets[src].withdraw(chunk, 0n).market;

      for (let dst = 0; dst < entries.length; dst++) {
        if (dst === src) continue;

        // Simulate supply to destination
        const dstAfter = simMarkets[dst].supply(chunk, 0n).market;

        // Temporarily apply to compute weighted APY
        const prevSrcMarket = simMarkets[src];
        const prevDstMarket = simMarkets[dst];
        simMarkets[src] = srcAfter;
        simMarkets[dst] = dstAfter;

        const prevSrcAlloc = allocations.get(srcKey)!;
        const dstKey = entries[dst].uniqueKey;
        const prevDstAlloc = allocations.get(dstKey)!;
        allocations.set(srcKey, prevSrcAlloc - chunk);
        allocations.set(dstKey, prevDstAlloc + chunk);

        const candidateApy = weightedApy(entries, allocations, simMarkets);

        // Revert
        simMarkets[src] = prevSrcMarket;
        simMarkets[dst] = prevDstMarket;
        allocations.set(srcKey, prevSrcAlloc);
        allocations.set(dstKey, prevDstAlloc);

        if (candidateApy > bestApy) {
          bestApy = candidateApy;
          bestSrc = src;
          bestDst = dst;
          bestSrcMarket = srcAfter;
          bestDstMarket = dstAfter;
        }
      }
    }

    // No move improves weighted APY — we're done
    if (bestSrc === -1 || !bestSrcMarket || !bestDstMarket) {
      console.log(`${LOG_TAG} round ${round}: converged. weighted APY=${(currentApy * 100).toFixed(6)}%`);
      break;
    }

    // Apply the best move
    const srcKey = entries[bestSrc].uniqueKey;
    const dstKey = entries[bestDst].uniqueKey;

    simMarkets[bestSrc] = bestSrcMarket;
    simMarkets[bestDst] = bestDstMarket;
    allocations.set(srcKey, allocations.get(srcKey)! - chunk);
    allocations.set(dstKey, allocations.get(dstKey)! + chunk);

    if (round < 5 || round % 500 === 0) {
      console.log(
        `${LOG_TAG} round ${round}: ${entries[bestSrc].collateralSymbol}→${entries[bestDst].collateralSymbol} ` +
        `| weighted APY: ${(currentApy * 100).toFixed(6)}%→${(bestApy * 100).toFixed(6)}%`,
      );
    }
  }

  // 8. Build result deltas
  const deltas: MarketDelta[] = entries.map((entry, i) => {
    const current = entry.currentSupply;
    const target = allocations.get(entry.uniqueKey)!;

    return {
      market: entry.originalMarket,
      currentAmount: current,
      targetAmount: target,
      delta: target - current,
      currentApy: entry.baselineMarket.supplyApy,
      projectedApy: simMarkets[i].supplyApy,
      currentUtilization: utilizationOf(entry.baselineMarket),
      projectedUtilization: utilizationOf(simMarkets[i]),
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
    deltas: deltas.sort((a, b) => Number(b.delta - a.delta)),
    totalPool,
    currentWeightedApy,
    projectedWeightedApy,
    loanAssetSymbol: groupedPosition.loanAssetSymbol,
    loanAssetDecimals: groupedPosition.loanAssetDecimals,
  };
}

// --- Logging ---

export function logSmartRebalanceResults(result: SmartRebalanceResult): void {
  const { deltas, totalPool, currentWeightedApy, projectedWeightedApy, loanAssetSymbol, loanAssetDecimals } = result;

  const fmt = (val: bigint) => formatReadable(formatBalance(val, loanAssetDecimals));
  const fmtApr = (apy: number) => `${(apyToApr(apy) * 100).toFixed(2)}%`;
  const fmtUtil = (u: number) => `${(u * 100).toFixed(1)}%`;

  console.log('\n=== Smart Rebalance Results (fresh on-chain data) ===');
  console.log(`Asset: ${loanAssetSymbol}  |  Total: ${fmt(totalPool)} ${loanAssetSymbol}`);
  console.log('');

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

  console.log('');
  const currentApr = apyToApr(currentWeightedApy);
  const projectedApr = apyToApr(projectedWeightedApy);
  const aprDiff = projectedApr - currentApr;
  console.log(`Weighted APR: ${fmtApr(currentWeightedApy)} → ${fmtApr(projectedWeightedApy)}  (${aprDiff >= 0 ? '+' : ''}${(aprDiff * 100).toFixed(4)}%)`);
  console.log('================================\n');
}
