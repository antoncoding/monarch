import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarkets } from '@/data-sources/morpho-api/market';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const SECONDS_PER_DAY = 24 * 60 * 60;

const LOOKBACK_WINDOWS = [
  {
    seconds: SECONDS_PER_DAY,
    supplyField: 'dailySupplyApy',
    borrowField: 'dailyBorrowApy',
  },
  {
    seconds: 7 * SECONDS_PER_DAY,
    supplyField: 'weeklySupplyApy',
    borrowField: 'weeklyBorrowApy',
  },
  {
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

const buildRateMetadata = (value: number | null, requestedPeriodSeconds: number): HistoricalRateMetadata =>
  buildHistoricalRateMetadata({
    status: value == null ? 'unavailable' : 'ready',
    reason: value == null ? 'missing_snapshot' : null,
    requestedPeriodSeconds,
    actualPeriodSeconds: value == null ? null : requestedPeriodSeconds,
  });

const buildEnrichmentFromMarket = (market: Market): MarketRateEnrichmentResult => {
  const values: MarketRateEnrichment = {
    dailySupplyApy: market.state.dailySupplyApy ?? null,
    dailyBorrowApy: market.state.dailyBorrowApy ?? null,
    weeklySupplyApy: market.state.weeklySupplyApy ?? null,
    weeklyBorrowApy: market.state.weeklyBorrowApy ?? null,
    monthlySupplyApy: market.state.monthlySupplyApy ?? null,
    monthlyBorrowApy: market.state.monthlyBorrowApy ?? null,
  };

  return {
    values,
    metadata: {
      dailySupplyApy: buildRateMetadata(values.dailySupplyApy, SECONDS_PER_DAY),
      dailyBorrowApy: buildRateMetadata(values.dailyBorrowApy, SECONDS_PER_DAY),
      weeklySupplyApy: buildRateMetadata(values.weeklySupplyApy, 7 * SECONDS_PER_DAY),
      weeklyBorrowApy: buildRateMetadata(values.weeklyBorrowApy, 7 * SECONDS_PER_DAY),
      monthlySupplyApy: buildRateMetadata(values.monthlySupplyApy, 30 * SECONDS_PER_DAY),
      monthlyBorrowApy: buildRateMetadata(values.monthlyBorrowApy, 30 * SECONDS_PER_DAY),
    },
  };
};

export const getMarketRateEnrichmentKey = (marketId: string, chainId: number): string => `${chainId}-${marketId.toLowerCase()}`;

export async function fetchMarketRateEnrichment(markets: Market[], _customRpcUrls: CustomRpcUrls = {}): Promise<MarketRateEnrichmentMap> {
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

  const marketsByChainEntries = Object.entries(marketsByChain) as [string, Market[]][];

  await Promise.all(
    marketsByChainEntries.map(async ([chainIdValue, chainMarkets]) => {
      const chainId = Number(chainIdValue) as SupportedNetworks;

      if (!supportsMorphoApi(chainId)) {
        chainMarkets.forEach((market) => {
          enrichments.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), buildEmptyEnrichment('fetch_failed'));
        });
        return;
      }

      try {
        const morphoMarkets = await fetchMorphoMarkets(chainId);
        const morphoMarketsByKey = morphoMarkets.reduce((acc, market) => {
          acc.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), market);
          return acc;
        }, new Map<string, Market>());

        chainMarkets.forEach((market) => {
          const marketKey = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
          const morphoMarket = morphoMarketsByKey.get(marketKey);
          enrichments.set(marketKey, morphoMarket ? buildEnrichmentFromMarket(morphoMarket) : buildEmptyEnrichment());
        });
      } catch (error) {
        console.warn(`[market-rate-enrichment] Failed to refresh historical rates for chain ${chainId}:`, error);
        chainMarkets.forEach((market) => {
          enrichments.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), buildEmptyEnrichment('fetch_failed'));
        });
      }
    }),
  );

  return enrichments;
}
