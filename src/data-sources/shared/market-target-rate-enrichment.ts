import { AdaptiveCurveIrmLib, MarketUtils } from '@morpho-org/blue-sdk';
import type { Address } from 'viem';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import type { Market } from '@/utils/types';
import { filterTokenBlacklistedMarkets } from './market-visibility';

const adaptiveCurveIrmAbi = [
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'rateAtTarget',
    outputs: [{ name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const TARGET_RATE_CHUNK_SIZE = 500;

type TargetRateEnrichmentOptions = {
  customRpcUrls?: CustomRpcUrls;
};

const normalizeRateAtTarget = (value: bigint | null | undefined): bigint => {
  if (typeof value === 'bigint' && value > 0n) {
    return value;
  }

  return AdaptiveCurveIrmLib.INITIAL_RATE_AT_TARGET;
};

const parseStoredRateAtTarget = (value: string): bigint | null => {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

export const marketNeedsTargetRateEnrichment = (market: Market): boolean => {
  const storedRateAtTarget = parseStoredRateAtTarget(market.state.rateAtTarget);

  return storedRateAtTarget == null || storedRateAtTarget <= 0n || market.state.apyAtTarget <= 0;
};

const applyTargetRate = (market: Market, rateAtTarget: bigint): Market => {
  const normalizedRateAtTarget = normalizeRateAtTarget(rateAtTarget);
  const nextRateAtTarget = normalizedRateAtTarget.toString();
  const nextApyAtTarget = MarketUtils.rateToApy(normalizedRateAtTarget);

  if (market.state.rateAtTarget === nextRateAtTarget && market.state.apyAtTarget === nextApyAtTarget) {
    return market;
  }

  return {
    ...market,
    state: {
      ...market.state,
      apyAtTarget: nextApyAtTarget,
      rateAtTarget: nextRateAtTarget,
    },
  };
};

const enrichChainMarketsWithTargetRate = async (
  chainId: SupportedNetworks,
  markets: Market[],
  options: TargetRateEnrichmentOptions,
): Promise<Market[]> => {
  if (markets.length === 0) {
    return markets;
  }

  const client = getClient(chainId, options.customRpcUrls?.[chainId]);
  const enrichedMarkets: Market[] = [];

  for (let index = 0; index < markets.length; index += TARGET_RATE_CHUNK_SIZE) {
    const marketBatch = markets.slice(index, index + TARGET_RATE_CHUNK_SIZE);
    const results = await client.multicall({
      allowFailure: true,
      contracts: marketBatch.map((market) => ({
        abi: adaptiveCurveIrmAbi,
        address: market.irmAddress as Address,
        args: [market.uniqueKey as `0x${string}`],
        functionName: 'rateAtTarget',
      })),
    });

    results.forEach((result, resultIndex) => {
      const market = marketBatch[resultIndex];

      if (!market) {
        return;
      }

      if (result.status !== 'success' || typeof result.result !== 'bigint') {
        enrichedMarkets.push(market);
        return;
      }

      enrichedMarkets.push(applyTargetRate(market, result.result));
    });
  }

  return enrichedMarkets;
};

export const enrichMarketsWithTargetRate = async (
  markets: Market[],
  options: TargetRateEnrichmentOptions = {},
): Promise<Market[]> => {
  const visibleMarkets = filterTokenBlacklistedMarkets(markets);
  const marketsByChain = new Map<SupportedNetworks, Market[]>();

  for (const market of visibleMarkets) {
    if (!marketNeedsTargetRateEnrichment(market)) {
      continue;
    }

    const chainMarkets = marketsByChain.get(market.morphoBlue.chain.id) ?? [];
    chainMarkets.push(market);
    marketsByChain.set(market.morphoBlue.chain.id, chainMarkets);
  }

  if (marketsByChain.size === 0) {
    return markets;
  }

  const chainResults = await Promise.allSettled(
    Array.from(marketsByChain.entries()).map(async ([chainId, chainMarkets]) => ({
      chainId,
      markets: await enrichChainMarketsWithTargetRate(chainId, chainMarkets, options),
    })),
  );

  const enrichedByUniqueKey = new Map<string, Market>();

  for (const result of chainResults) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    for (const market of result.value.markets) {
      enrichedByUniqueKey.set(getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id), market);
    }
  }

  return markets.map((market) => {
    const marketKey = getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id);
    return enrichedByUniqueKey.get(marketKey) ?? market;
  });
};
