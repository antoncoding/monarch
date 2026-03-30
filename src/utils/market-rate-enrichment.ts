import { SharesMath } from '@morpho-org/blue-sdk';
import { computeAnnualizedApyFromGrowth } from '@/hooks/leverage/math';
import { fetchBlocksWithTimestamps } from '@/utils/blockEstimation';
import { type MarketSnapshot, fetchMarketsSnapshots } from '@/utils/positions';
import { getClient } from '@/utils/rpc';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const SECONDS_PER_DAY = 24 * 60 * 60;
const SHARE_PRICE_SCALE = 10n ** 18n;
const MAX_WINDOW_EDGE_STALENESS_RATIO = 1;
const MAX_WINDOW_PERIOD_DRIFT_RATIO = 0.5;
const MIN_WINDOW_EDGE_STALENESS_SECONDS = 60;

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

export type HistoricalRateField = keyof MarketRateEnrichment;

export type HistoricalRateStatus = 'ready' | 'stale' | 'unavailable';

export type HistoricalRateReason =
  | 'missing_snapshot'
  | 'missing_share_price'
  | 'current_outside_window'
  | 'past_outside_window'
  | 'window_mismatch'
  | 'fetch_failed';

export type HistoricalRateMetadata = {
  status: HistoricalRateStatus;
  reason: HistoricalRateReason | null;
  requestedPeriodSeconds: number;
  actualPeriodSeconds: number | null;
  currentLastUpdate: number | null;
  pastLastUpdate: number | null;
};

export type MarketRateMetadata = Record<HistoricalRateField, HistoricalRateMetadata>;

export type MarketRateEnrichmentResult = {
  values: MarketRateEnrichment;
  metadata: MarketRateMetadata;
};

export type MarketRateEnrichmentMap = Map<string, MarketRateEnrichmentResult>;

const buildHistoricalRateMetadata = ({
  status,
  reason = null,
  requestedPeriodSeconds,
  actualPeriodSeconds = null,
  currentLastUpdate = null,
  pastLastUpdate = null,
}: {
  status: HistoricalRateStatus;
  reason?: HistoricalRateReason | null;
  requestedPeriodSeconds: number;
  actualPeriodSeconds?: number | null;
  currentLastUpdate?: number | null;
  pastLastUpdate?: number | null;
}): HistoricalRateMetadata => ({
  status,
  reason,
  requestedPeriodSeconds,
  actualPeriodSeconds,
  currentLastUpdate,
  pastLastUpdate,
});

const buildEmptyEnrichment = (reason: HistoricalRateReason = 'missing_snapshot'): MarketRateEnrichmentResult =>
  LOOKBACK_WINDOWS.reduce<MarketRateEnrichmentResult>(
    (acc, window) => {
      acc.values[window.supplyField] = null;
      acc.values[window.borrowField] = null;
      acc.metadata[window.supplyField] = buildHistoricalRateMetadata({
        status: 'unavailable',
        reason,
        requestedPeriodSeconds: window.seconds,
      });
      acc.metadata[window.borrowField] = buildHistoricalRateMetadata({
        status: 'unavailable',
        reason,
        requestedPeriodSeconds: window.seconds,
      });
      return acc;
    },
    {
      values: {
        dailySupplyApy: null,
        dailyBorrowApy: null,
        weeklySupplyApy: null,
        weeklyBorrowApy: null,
        monthlySupplyApy: null,
        monthlyBorrowApy: null,
      },
      metadata: {
        dailySupplyApy: buildHistoricalRateMetadata({ status: 'unavailable', reason, requestedPeriodSeconds: SECONDS_PER_DAY }),
        dailyBorrowApy: buildHistoricalRateMetadata({ status: 'unavailable', reason, requestedPeriodSeconds: SECONDS_PER_DAY }),
        weeklySupplyApy: buildHistoricalRateMetadata({ status: 'unavailable', reason, requestedPeriodSeconds: 7 * SECONDS_PER_DAY }),
        weeklyBorrowApy: buildHistoricalRateMetadata({ status: 'unavailable', reason, requestedPeriodSeconds: 7 * SECONDS_PER_DAY }),
        monthlySupplyApy: buildHistoricalRateMetadata({ status: 'unavailable', reason, requestedPeriodSeconds: 30 * SECONDS_PER_DAY }),
        monthlyBorrowApy: buildHistoricalRateMetadata({ status: 'unavailable', reason, requestedPeriodSeconds: 30 * SECONDS_PER_DAY }),
      },
    },
  );

export const getMarketRateEnrichmentKey = (marketId: string, chainId: number): string => `${chainId}-${marketId.toLowerCase()}`;

const computeSharePrice = (assets: string, shares: string): bigint | null => {
  try {
    const assetAmount = BigInt(assets);
    const shareAmount = BigInt(shares);

    if (assetAmount <= 0n || shareAmount <= 0n) {
      return null;
    }

    return SharesMath.toAssets(SHARE_PRICE_SCALE, assetAmount, shareAmount, 'Down');
  } catch {
    return null;
  }
};

const getAllowedBoundaryStalenessSeconds = (periodSeconds: number): number => {
  if (periodSeconds <= 0) {
    return 0;
  }

  return Math.max(MIN_WINDOW_EDGE_STALENESS_SECONDS, Math.floor(periodSeconds * MAX_WINDOW_EDGE_STALENESS_RATIO));
};

const getMaxAllowedPeriodDriftSeconds = (periodSeconds: number): number => {
  if (periodSeconds <= 0) {
    return 0;
  }

  return Math.max(MIN_WINDOW_EDGE_STALENESS_SECONDS, Math.floor(periodSeconds * MAX_WINDOW_PERIOD_DRIFT_RATIO));
};

const computeRealizedRate = ({
  currentSnapshot,
  pastSnapshot,
  periodSeconds,
  currentBoundaryTimestamp,
  pastBoundaryTimestamp,
  side,
}: {
  currentSnapshot: MarketSnapshot | undefined;
  pastSnapshot: MarketSnapshot | undefined;
  periodSeconds: number;
  currentBoundaryTimestamp: number;
  pastBoundaryTimestamp: number;
  side: 'supply' | 'borrow';
}): { value: number | null; metadata: HistoricalRateMetadata } => {
  const baseMetadata = {
    requestedPeriodSeconds: periodSeconds,
    currentLastUpdate: currentSnapshot?.lastUpdate ?? null,
    pastLastUpdate: pastSnapshot?.lastUpdate ?? null,
  };

  if (!currentSnapshot || !pastSnapshot || periodSeconds <= 0) {
    return {
      value: null,
      metadata: buildHistoricalRateMetadata({
        ...baseMetadata,
        status: 'unavailable',
        reason: 'missing_snapshot',
      }),
    };
  }

  const allowedBoundaryStalenessSeconds = getAllowedBoundaryStalenessSeconds(periodSeconds);
  const currentBoundaryStaleness = currentBoundaryTimestamp - currentSnapshot.lastUpdate;
  const pastBoundaryStaleness = pastBoundaryTimestamp - pastSnapshot.lastUpdate;

  if (
    currentBoundaryStaleness < 0 ||
    pastBoundaryStaleness < 0 ||
    currentBoundaryStaleness > allowedBoundaryStalenessSeconds ||
    pastBoundaryStaleness > allowedBoundaryStalenessSeconds
  ) {
    return {
      value: null,
      metadata: buildHistoricalRateMetadata({
        ...baseMetadata,
        status: 'stale',
        reason: currentBoundaryStaleness > allowedBoundaryStalenessSeconds ? 'current_outside_window' : 'past_outside_window',
      }),
    };
  }

  const actualPeriodSeconds = currentSnapshot.lastUpdate - pastSnapshot.lastUpdate;
  const maxAllowedPeriodDriftSeconds = getMaxAllowedPeriodDriftSeconds(periodSeconds);

  if (actualPeriodSeconds <= 0 || Math.abs(actualPeriodSeconds - periodSeconds) > maxAllowedPeriodDriftSeconds) {
    return {
      value: null,
      metadata: buildHistoricalRateMetadata({
        ...baseMetadata,
        status: 'stale',
        reason: 'window_mismatch',
        actualPeriodSeconds,
      }),
    };
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
    return {
      value: null,
      metadata: buildHistoricalRateMetadata({
        ...baseMetadata,
        status: 'unavailable',
        reason: 'missing_share_price',
        actualPeriodSeconds,
      }),
    };
  }

  return {
    value: computeAnnualizedApyFromGrowth({
      currentValue: currentSharePrice,
      pastValue: pastSharePrice,
      periodSeconds: actualPeriodSeconds,
    }),
    metadata: buildHistoricalRateMetadata({
      ...baseMetadata,
      status: 'ready',
      actualPeriodSeconds,
    }),
  };
};

export async function fetchMarketRateEnrichment(markets: Market[], customRpcUrls: CustomRpcUrls = {}): Promise<MarketRateEnrichmentMap> {
  const enrichments = new Map<string, MarketRateEnrichmentResult>();

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
          const enrichment = buildEmptyEnrichment();
          const marketKey = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
          const currentSnapshot = currentSnapshots.get(market.uniqueKey.toLowerCase());

          LOOKBACK_WINDOWS.forEach((window, index) => {
            const pastBlock = blocksWithTimestamps[index];
            const pastSnapshot = pastSnapshots[index]?.get(market.uniqueKey.toLowerCase());
            if (!pastBlock) {
              return;
            }

            const periodSeconds = currentTimestamp - pastBlock.timestamp;

            const supplyResult = computeRealizedRate({
              currentSnapshot,
              pastSnapshot,
              periodSeconds,
              currentBoundaryTimestamp: currentTimestamp,
              pastBoundaryTimestamp: pastBlock.timestamp,
              side: 'supply',
            });
            const borrowResult = computeRealizedRate({
              currentSnapshot,
              pastSnapshot,
              periodSeconds,
              currentBoundaryTimestamp: currentTimestamp,
              pastBoundaryTimestamp: pastBlock.timestamp,
              side: 'borrow',
            });

            enrichment.values[window.supplyField] = supplyResult.value;
            enrichment.values[window.borrowField] = borrowResult.value;
            enrichment.metadata[window.supplyField] = supplyResult.metadata;
            enrichment.metadata[window.borrowField] = borrowResult.metadata;
          });

          enrichments.set(marketKey, enrichment);
        }
      } catch (error) {
        console.warn(`[market-rate-enrichment] Failed to compute historical rates for chain ${chainId}:`, error);
        chainMarkets.forEach((market) => {
          enrichments.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), buildEmptyEnrichment('fetch_failed'));
        });
      }
    }),
  );

  return enrichments;
}
