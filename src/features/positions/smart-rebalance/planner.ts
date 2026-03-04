import { Market as BlueMarket, MarketParams as BlueMarketParams } from '@morpho-org/blue-sdk';
import morphoABI from '@/abis/morpho';
import { getMorphoAddress } from '@/utils/morpho';
import { getClient } from '@/utils/rpc';
import type { GroupedPosition, Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import { planRebalance } from './engine';
import type { SmartRebalanceConstraintMap, SmartRebalanceEngineOutput } from './types';

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

function hasPlannerRequiredFields(market: Market): boolean {
  return (
    !!market.loanAsset?.address &&
    !!market.collateralAsset?.address &&
    !!market.oracleAddress &&
    !!market.irmAddress &&
    market.lltv !== undefined
  );
}

function selectUniqueMarkets(candidateMarkets: Market[], includedMarketKeys: Set<string>): Market[] {
  const byKey = new Map<string, Market>();

  for (const market of candidateMarkets) {
    if (!includedMarketKeys.has(market.uniqueKey)) continue;

    const existing = byKey.get(market.uniqueKey);
    if (!existing) {
      byKey.set(market.uniqueKey, market);
      continue;
    }

    // Prefer a duplicate candidate that has complete planner-critical fields.
    if (!hasPlannerRequiredFields(existing) && hasPlannerRequiredFields(market)) {
      byKey.set(market.uniqueKey, market);
    }
  }

  return [...byKey.values()];
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

  const selectedMarkets = selectUniqueMarkets(candidateMarkets, includedMarketKeys);
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
    blockTag: 'latest',
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
    const maxWithdrawable = currentSupply < baselineMarket.liquidity ? currentSupply : baselineMarket.liquidity;

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

  const optimized = planRebalance({
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
