import { Market as BlueMarket, MarketParams as BlueMarketParams } from '@morpho-org/blue-sdk';
import morphoABI from '@/abis/morpho';
import { getMorphoAddress } from '@/utils/morpho';
import { getClient } from '@/utils/rpc';
import type { GroupedPosition, Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import { optimizeSmartRebalance } from './engine';
import type { SmartRebalanceConstraintMap, SmartRebalanceEngineOutput } from './types';

const DUST_AMOUNT = 1000n;

export type SmartRebalancePlan = SmartRebalanceEngineOutput & {
  loanAssetSymbol: string;
  loanAssetDecimals: number;
};

type BuildSmartRebalancePlanInput = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  candidateMarkets: Market[];
  includedMarketKeys: Set<string>;
  constraints?: SmartRebalanceConstraintMap;
};

const APY_SCALE = 1_000_000_000_000n;

function toApyScaled(apy: number): bigint {
  if (!Number.isFinite(apy)) return 0n;
  return BigInt(Math.round(apy * Number(APY_SCALE)));
}

function objectiveToWeightedApy(objective: bigint, totalPool: bigint): number {
  if (totalPool <= 0n) return 0;
  const scaled = objective / totalPool;
  return Number(scaled) / Number(APY_SCALE);
}

function normalizeMaxBps(raw: number | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!Number.isFinite(raw)) return undefined;
  if (raw <= 0) return 0;
  if (raw >= 10_000) return 10_000;
  return Math.floor(raw);
}

/**
 * Loads fresh on-chain market state and builds a smart-rebalance plan.
 *
 * Responsibilities:
 * - Resolve candidate markets
 * - Fetch live `market()` snapshots from Morpho
 * - Build engine input entries (current supply + withdraw limits)
 * - Run pure optimizer
 */
export async function calculateSmartRebalancePlan({
  groupedPosition,
  chainId,
  candidateMarkets,
  includedMarketKeys,
  constraints,
}: BuildSmartRebalancePlanInput): Promise<SmartRebalancePlan | null> {
  if (includedMarketKeys.size === 0) return null;

  const selectedMarkets = candidateMarkets.filter((market) => includedMarketKeys.has(market.uniqueKey));
  if (selectedMarkets.length === 0) return null;

  const client = getClient(chainId);
  const morphoAddress = getMorphoAddress(chainId);

  const multicallResults = await client.multicall({
    contracts: selectedMarkets.map((market) => ({
      address: morphoAddress as `0x${string}`,
      abi: morphoABI,
      functionName: 'market' as const,
      args: [market.uniqueKey as `0x${string}`],
    })),
    allowFailure: true,
  });

  const userSupplyByMarket = new Map(
    groupedPosition.markets.map((position) => [position.market.uniqueKey, BigInt(position.state.supplyAssets)]),
  );

  const entries = selectedMarkets.flatMap((market, index) => {
    const result = multicallResults[index];
    if (result.status !== 'success' || !result.result) {
      return [];
    }

    const [totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee] = result.result;

    if (
      !market.loanAsset?.address ||
      !market.collateralAsset?.address ||
      !market.oracleAddress ||
      !market.irmAddress ||
      market.lltv === undefined
    ) {
      return [];
    }

    const params = new BlueMarketParams({
      loanToken: market.loanAsset.address as `0x${string}`,
      collateralToken: market.collateralAsset.address as `0x${string}`,
      oracle: market.oracleAddress as `0x${string}`,
      irm: market.irmAddress as `0x${string}`,
      lltv: BigInt(market.lltv),
    });

    const baselineMarket = new BlueMarket({
      params,
      totalSupplyAssets,
      totalBorrowAssets,
      totalSupplyShares,
      totalBorrowShares,
      lastUpdate,
      fee,
      rateAtTarget: BigInt(market.state.rateAtTarget),
    });

    const currentSupply = userSupplyByMarket.get(market.uniqueKey) ?? 0n;
    const normalizedMaxBps = normalizeMaxBps(constraints?.[market.uniqueKey]?.maxAllocationBps);
    const allowFullWithdraw = normalizedMaxBps === 0;
    const safeSupply = currentSupply > DUST_AMOUNT ? currentSupply - DUST_AMOUNT : 0n;
    const maxFromUser = allowFullWithdraw ? currentSupply : safeSupply;
    const maxWithdrawable = maxFromUser < baselineMarket.liquidity ? maxFromUser : baselineMarket.liquidity;

    return [
      {
        uniqueKey: market.uniqueKey,
        market,
        baselineMarket,
        currentSupply,
        maxWithdrawable,
      },
    ];
  });

  if (entries.length === 0) return null;

  const suppliedEntries = entries.filter((entry) => entry.currentSupply > 0n);
  const totalPool = entries.reduce((sum, entry) => sum + entry.currentSupply, 0n);
  const withdrawAllRequested =
    suppliedEntries.length > 0 &&
    suppliedEntries.every((entry) => {
      const normalized = normalizeMaxBps(constraints?.[entry.uniqueKey]?.maxAllocationBps);
      return normalized === 0;
    });

  const hasDestinationCapacity = entries.some((entry) => {
    const normalized = normalizeMaxBps(constraints?.[entry.uniqueKey]?.maxAllocationBps);
    if (normalized === 0) return false;
    if (normalized === undefined || normalized >= 10_000) return true;

    const maxAllowed = (totalPool * BigInt(normalized)) / 10_000n;
    return entry.currentSupply < maxAllowed;
  });

  if (withdrawAllRequested && !hasDestinationCapacity) {
    const currentObjective = entries.reduce((sum, entry) => sum + entry.currentSupply * toApyScaled(entry.baselineMarket.supplyApy), 0n);

    const deltas = entries.map((entry) => {
      const withdrawAmount = entry.maxWithdrawable < entry.currentSupply ? entry.maxWithdrawable : entry.currentSupply;
      const targetAmount = entry.currentSupply - withdrawAmount;
      const projectedMarket = withdrawAmount > 0n ? entry.baselineMarket.withdraw(withdrawAmount, 0n).market : entry.baselineMarket;

      return {
        market: entry.market,
        currentAmount: entry.currentSupply,
        targetAmount,
        delta: targetAmount - entry.currentSupply,
        currentApy: entry.baselineMarket.supplyApy,
        projectedApy: projectedMarket.supplyApy,
        currentUtilization: Number(entry.baselineMarket.utilization) / 1e18,
        projectedUtilization: Number(projectedMarket.utilization) / 1e18,
        collateralSymbol: entry.market.collateralAsset?.symbol ?? 'N/A',
      };
    });

    const projectedObjective = deltas.reduce((sum, delta) => sum + delta.targetAmount * toApyScaled(delta.projectedApy), 0n);
    const totalMoved = deltas.reduce((sum, delta) => (delta.delta < 0n ? sum + -delta.delta : sum), 0n);

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
      loanAssetSymbol: groupedPosition.loanAssetSymbol,
      loanAssetDecimals: groupedPosition.loanAssetDecimals,
    };
  }

  const optimized = optimizeSmartRebalance({
    entries,
    constraints,
  });

  if (!optimized) return null;

  return {
    ...optimized,
    loanAssetSymbol: groupedPosition.loanAssetSymbol,
    loanAssetDecimals: groupedPosition.loanAssetDecimals,
  };
}
