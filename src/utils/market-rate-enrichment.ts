import { computeAnnualizedApyFromGrowth } from '@/hooks/leverage/math';
import { fetchBlocksWithTimestamps } from '@/utils/blockEstimation';
import { type MarketSnapshot, fetchMarketsSnapshots } from '@/utils/positions';
import { getClient } from '@/utils/rpc';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const SECONDS_PER_DAY = 24 * 60 * 60;
const SHARE_PRICE_SCALE = 10n ** 18n;

const LOOKBACK_WINDOWS = [
  {
    key: 'daily',
    seconds: SECONDS_PER_DAY,
    supplyField: 'dailySupplyApy',
    borrowField: 'dailyBorrowApy',
  },
  {
    key: 'weekly',
    seconds: 7 * SECONDS_PER_DAY,
    supplyField: 'weeklySupplyApy',
    borrowField: 'weeklyBorrowApy',
  },
  {
    key: 'monthly',
    seconds: 30 * SECONDS_PER_DAY,
    supplyField: 'monthlySupplyApy',
    borrowField: 'monthlyBorrowApy',
  },
] as const;

export type MarketRateEnrichment = Pick<
  Market['state'],
  'dailySupplyApy' | 'dailyBorrowApy' | 'weeklySupplyApy' | 'weeklyBorrowApy' | 'monthlySupplyApy' | 'monthlyBorrowApy'
>;

export type MarketRateEnrichmentMap = Map<string, MarketRateEnrichment>;

const buildNullEnrichment = (): MarketRateEnrichment => ({
  dailySupplyApy: null,
  dailyBorrowApy: null,
  weeklySupplyApy: null,
  weeklyBorrowApy: null,
  monthlySupplyApy: null,
  monthlyBorrowApy: null,
});

export const getMarketRateEnrichmentKey = (marketId: string, chainId: number): string => `${chainId}-${marketId.toLowerCase()}`;

const computeSharePrice = (assets: string, shares: string): bigint | null => {
  try {
    const assetAmount = BigInt(assets);
    const shareAmount = BigInt(shares);

    if (assetAmount <= 0n || shareAmount <= 0n) {
      return null;
    }

    return (assetAmount * SHARE_PRICE_SCALE) / shareAmount;
  } catch {
    return null;
  }
};

const computeRealizedRate = ({
  currentSnapshot,
  pastSnapshot,
  periodSeconds,
  side,
}: {
  currentSnapshot: MarketSnapshot | undefined;
  pastSnapshot: MarketSnapshot | undefined;
  periodSeconds: number;
  side: 'supply' | 'borrow';
}): number | null => {
  if (!currentSnapshot || !pastSnapshot || periodSeconds <= 0) {
    return null;
  }

  const currentSharePrice =
    side === 'supply'
      ? computeSharePrice(currentSnapshot.totalSupplyAssets, currentSnapshot.totalSupplyShares)
      : computeSharePrice(currentSnapshot.totalBorrowAssets, currentSnapshot.totalBorrowShares);
  const pastSharePrice =
    side === 'supply'
      ? computeSharePrice(pastSnapshot.totalSupplyAssets, pastSnapshot.totalSupplyShares)
      : computeSharePrice(pastSnapshot.totalBorrowAssets, pastSnapshot.totalBorrowShares);

  if (!currentSharePrice || !pastSharePrice) {
    return null;
  }

  return computeAnnualizedApyFromGrowth({
    currentValue: currentSharePrice,
    pastValue: pastSharePrice,
    periodSeconds,
  });
};

export async function fetchMarketRateEnrichment(
  markets: Market[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<MarketRateEnrichmentMap> {
  const enrichments = new Map<string, MarketRateEnrichment>();

  if (markets.length === 0) {
    return enrichments;
  }

  const marketsByChain = markets.reduce(
    (acc, market) => {
      const chainId = market.morphoBlue.chain.id;
      const chainMarkets = acc[chainId] ?? [];
      chainMarkets.push(market);
      acc[chainId] = chainMarkets;
      return acc;
    },
    {} as Record<SupportedNetworks, Market[]>,
  );

  await Promise.all(
    Object.entries(marketsByChain).map(async ([chainIdValue, chainMarkets]) => {
      const chainId = Number(chainIdValue) as SupportedNetworks;

      try {
        const client = getClient(chainId, customRpcUrls[chainId]);
        const currentBlock = await client.getBlockNumber();
        const currentBlockData = await client.getBlock({ blockNumber: currentBlock });
        const currentTimestamp = Number(currentBlockData.timestamp);
        const targetTimestamps = LOOKBACK_WINDOWS.map((window) => currentTimestamp - window.seconds);
        const blocksWithTimestamps = await fetchBlocksWithTimestamps(
          client,
          chainId,
          targetTimestamps,
          Number(currentBlock),
          currentTimestamp,
        );
        const marketIds = chainMarkets.map((market) => market.uniqueKey);

        const [currentSnapshots, ...pastSnapshots] = await Promise.all([
          fetchMarketsSnapshots(marketIds, chainId, client, Number(currentBlock)),
          ...blocksWithTimestamps.map((block) => fetchMarketsSnapshots(marketIds, chainId, client, block.blockNumber)),
        ]);

        for (const market of chainMarkets) {
          const enrichment = buildNullEnrichment();
          const marketKey = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
          const currentSnapshot = currentSnapshots.get(market.uniqueKey.toLowerCase());

          LOOKBACK_WINDOWS.forEach((window, index) => {
            const pastBlock = blocksWithTimestamps[index];
            const pastSnapshot = pastSnapshots[index]?.get(market.uniqueKey.toLowerCase());
            const periodSeconds = pastBlock ? currentTimestamp - pastBlock.timestamp : 0;

            enrichment[window.supplyField] = computeRealizedRate({
              currentSnapshot,
              pastSnapshot,
              periodSeconds,
              side: 'supply',
            });
            enrichment[window.borrowField] = computeRealizedRate({
              currentSnapshot,
              pastSnapshot,
              periodSeconds,
              side: 'borrow',
            });
          });

          enrichments.set(marketKey, enrichment);
        }
      } catch (error) {
        console.warn(`[market-rate-enrichment] Failed to compute historical rates for chain ${chainId}:`, error);
      }
    }),
  );

  return enrichments;
}
