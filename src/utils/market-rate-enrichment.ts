import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { fetchMorphoMarketRateEnrichments, getMorphoMarketRateFieldsKey } from '@/data-sources/morpho-api/market-rate-fields';
import { MarketUtils, SharesMath } from '@morpho-org/blue-sdk';
import type { Address } from 'viem';
import { morphoIrmAbi } from '@/abis/morpho-irm';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { fetchBlocksWithTimestamps } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import { fetchMarketsSnapshots, type MarketSnapshot } from '@/utils/positions';
import { computeAnnualizedApyFromGrowth } from '@/utils/rateMath';
import { getClient } from '@/utils/rpc';
import type { Market } from '@/utils/types';

const SECONDS_PER_DAY = 24 * 60 * 60;
const BORROW_RATE_BATCH_SIZE = 100;
const BORROW_RATE_PARALLEL_BATCHES = 2;

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

type LookbackWindow = (typeof LOOKBACK_WINDOWS)[number];

export type RateEnrichmentMarketInput = Pick<Market, 'uniqueKey' | 'lltv' | 'irmAddress' | 'oracleAddress'> & {
  loanAsset: Pick<Market['loanAsset'], 'address'>;
  collateralAsset: Pick<Market['collateralAsset'], 'address'>;
  morphoBlue: {
    chain: {
      id: number;
    };
  };
};

type BoundaryState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  timestamp: number;
};

export type WindowRealizedRates = {
  supplyApy: number | null;
  borrowApy: number | null;
};

type MarketWindowRates = Map<number, WindowRealizedRates>;

export type MarketWindowRatesMap = Map<string, MarketWindowRates>;

export type MarketRateEnrichment = Pick<
  Market['state'],
  | 'apyAtTarget'
  | 'rateAtTarget'
  | 'dailySupplyApy'
  | 'dailyBorrowApy'
  | 'weeklySupplyApy'
  | 'weeklyBorrowApy'
  | 'monthlySupplyApy'
  | 'monthlyBorrowApy'
>;

export type MarketRateEnrichmentMap = Map<string, MarketRateEnrichment>;
export const ROLLING_RATE_WINDOW_SECONDS = LOOKBACK_WINDOWS.map((window) => window.seconds);

const buildEmptyEnrichment = (): MarketRateEnrichment => ({
  apyAtTarget: 0,
  rateAtTarget: '0',
  dailySupplyApy: null,
  dailyBorrowApy: null,
  weeklySupplyApy: null,
  weeklyBorrowApy: null,
  monthlySupplyApy: null,
  monthlyBorrowApy: null,
});

const buildEmptyWindowRates = (windowSeconds: number[]): MarketWindowRates =>
  new Map(windowSeconds.map((seconds) => [seconds, { supplyApy: null, borrowApy: null }]));

const toBigInt = (value: string | number | bigint): bigint => BigInt(value);

export const getWindowRatesFromEnrichment = (enrichment: MarketRateEnrichment | undefined, windowSeconds: number): WindowRealizedRates => {
  if (!enrichment) {
    return { supplyApy: null, borrowApy: null };
  }

  switch (windowSeconds) {
    case LOOKBACK_WINDOWS[0].seconds:
      return {
        supplyApy: enrichment.dailySupplyApy,
        borrowApy: enrichment.dailyBorrowApy,
      };
    case LOOKBACK_WINDOWS[1].seconds:
      return {
        supplyApy: enrichment.weeklySupplyApy,
        borrowApy: enrichment.weeklyBorrowApy,
      };
    case LOOKBACK_WINDOWS[2].seconds:
      return {
        supplyApy: enrichment.monthlySupplyApy,
        borrowApy: enrichment.monthlyBorrowApy,
      };
    default:
      return { supplyApy: null, borrowApy: null };
  }
};

const isUninitializedSnapshot = (snapshot: MarketSnapshot): boolean =>
  snapshot.lastUpdate === 0 &&
  snapshot.totalSupplyAssets === '0' &&
  snapshot.totalSupplyShares === '0' &&
  snapshot.totalBorrowAssets === '0' &&
  snapshot.totalBorrowShares === '0';

const accrueSnapshotToTimestamp = (snapshot: MarketSnapshot, avgBorrowRate: bigint, boundaryTimestamp: number): BoundaryState | null => {
  if (!Number.isFinite(boundaryTimestamp) || boundaryTimestamp < snapshot.lastUpdate) {
    return null;
  }

  const totalSupplyAssets = toBigInt(snapshot.totalSupplyAssets);
  const totalSupplyShares = toBigInt(snapshot.totalSupplyShares);
  const totalBorrowAssets = toBigInt(snapshot.totalBorrowAssets);
  const totalBorrowShares = toBigInt(snapshot.totalBorrowShares);
  const fee = toBigInt(snapshot.fee);
  const elapsed = BigInt(Math.max(0, boundaryTimestamp - snapshot.lastUpdate));
  const { interest, feeShares } = MarketUtils.getAccruedInterest(
    avgBorrowRate,
    {
      totalSupplyAssets,
      totalBorrowAssets,
      totalSupplyShares,
      fee,
    },
    elapsed,
  );

  return {
    totalSupplyAssets: totalSupplyAssets + interest,
    totalSupplyShares: totalSupplyShares + feeShares,
    totalBorrowAssets: totalBorrowAssets + interest,
    totalBorrowShares,
    timestamp: boundaryTimestamp,
  };
};

const computeRealizedApyFromSharePriceGrowth = ({
  startAssets,
  startShares,
  endAssets,
  endShares,
  periodSeconds,
}: {
  startAssets: bigint;
  startShares: bigint;
  endAssets: bigint;
  endShares: bigint;
  periodSeconds: number;
}): number | null =>
  computeAnnualizedApyFromGrowth({
    currentValue: (endAssets + SharesMath.VIRTUAL_ASSETS) * (startShares + SharesMath.VIRTUAL_SHARES),
    pastValue: (startAssets + SharesMath.VIRTUAL_ASSETS) * (endShares + SharesMath.VIRTUAL_SHARES),
    periodSeconds,
  });

const computeWindowRates = (startState: BoundaryState, endState: BoundaryState): WindowRealizedRates => {
  const periodSeconds = endState.timestamp - startState.timestamp;
  if (periodSeconds <= 0) {
    return { supplyApy: null, borrowApy: null };
  }

  return {
    supplyApy: computeRealizedApyFromSharePriceGrowth({
      startAssets: startState.totalSupplyAssets,
      startShares: startState.totalSupplyShares,
      endAssets: endState.totalSupplyAssets,
      endShares: endState.totalSupplyShares,
      periodSeconds,
    }),
    borrowApy: computeRealizedApyFromSharePriceGrowth({
      startAssets: startState.totalBorrowAssets,
      startShares: startState.totalBorrowShares,
      endAssets: endState.totalBorrowAssets,
      endShares: endState.totalBorrowShares,
      periodSeconds,
    }),
  };
};

const mergeMarketRateEnrichment = (primary: MarketRateEnrichment, fallback: MarketRateEnrichment): MarketRateEnrichment => ({
  apyAtTarget: primary.apyAtTarget ?? fallback.apyAtTarget,
  rateAtTarget: primary.rateAtTarget || fallback.rateAtTarget,
  dailySupplyApy: primary.dailySupplyApy ?? fallback.dailySupplyApy,
  dailyBorrowApy: primary.dailyBorrowApy ?? fallback.dailyBorrowApy,
  weeklySupplyApy: primary.weeklySupplyApy ?? fallback.weeklySupplyApy,
  weeklyBorrowApy: primary.weeklyBorrowApy ?? fallback.weeklyBorrowApy,
  monthlySupplyApy: primary.monthlySupplyApy ?? fallback.monthlySupplyApy,
  monthlyBorrowApy: primary.monthlyBorrowApy ?? fallback.monthlyBorrowApy,
});

const hasMissingRateFields = (enrichment: MarketRateEnrichment): boolean =>
  enrichment.dailySupplyApy == null ||
  enrichment.dailyBorrowApy == null ||
  enrichment.weeklySupplyApy == null ||
  enrichment.weeklyBorrowApy == null ||
  enrichment.monthlySupplyApy == null ||
  enrichment.monthlyBorrowApy == null;

const buildApiEnrichmentFromMarket = (market: Market): MarketRateEnrichment => ({
  apyAtTarget: market.state.apyAtTarget,
  rateAtTarget: market.state.rateAtTarget,
  dailySupplyApy: market.state.dailySupplyApy ?? null,
  dailyBorrowApy: market.state.dailyBorrowApy ?? null,
  weeklySupplyApy: market.state.weeklySupplyApy ?? null,
  weeklyBorrowApy: market.state.weeklyBorrowApy ?? null,
  monthlySupplyApy: market.state.monthlySupplyApy ?? null,
  monthlyBorrowApy: market.state.monthlyBorrowApy ?? null,
});

const fetchMorphoRateMarketsByKey = async (
  chainMarkets: RateEnrichmentMarketInput[],
  chainId: SupportedNetworks,
): Promise<Map<string, MarketRateEnrichment>> => {
  if (!supportsMorphoApi(chainId)) {
    return new Map();
  }

  try {
    if (chainMarkets.length === 1) {
      const morphoMarket = await fetchMorphoMarket(chainMarkets[0].uniqueKey, chainId);
      if (!morphoMarket) {
        return new Map();
      }

      return new Map([[getMarketRateEnrichmentKey(morphoMarket.uniqueKey, chainId), buildApiEnrichmentFromMarket(morphoMarket)]]);
    }

    const morphoEnrichments = await fetchMorphoMarketRateEnrichments(chainId);
    return chainMarkets.reduce((acc, market) => {
      const enrichment = morphoEnrichments.get(getMorphoMarketRateFieldsKey(chainId, market.uniqueKey));
      if (!enrichment) {
        return acc;
      }

      acc.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), enrichment);
      return acc;
    }, new Map<string, MarketRateEnrichment>());
  } catch (error) {
    console.warn(`[market-rate-enrichment] Failed to fetch Morpho rolling rates for chain ${chainId}:`, error);
    return new Map();
  }
};

const fetchBoundaryBorrowRates = async (
  markets: RateEnrichmentMarketInput[],
  snapshots: Map<string, MarketSnapshot>,
  client: ReturnType<typeof getClient>,
  blockNumber: number,
): Promise<Map<string, bigint>> => {
  const marketContracts = markets
    .map((market) => {
      const snapshot = snapshots.get(market.uniqueKey.toLowerCase());
      if (!snapshot || isUninitializedSnapshot(snapshot)) {
        return null;
      }

      return {
        marketKey: market.uniqueKey.toLowerCase(),
        contract: {
          address: market.irmAddress as Address,
          abi: morphoIrmAbi,
          functionName: 'borrowRateView' as const,
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            {
              totalSupplyAssets: toBigInt(snapshot.totalSupplyAssets),
              totalSupplyShares: toBigInt(snapshot.totalSupplyShares),
              totalBorrowAssets: toBigInt(snapshot.totalBorrowAssets),
              totalBorrowShares: toBigInt(snapshot.totalBorrowShares),
              lastUpdate: BigInt(snapshot.lastUpdate),
              fee: toBigInt(snapshot.fee),
            },
          ],
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const borrowRates = new Map<string, bigint>();
  if (marketContracts.length === 0) {
    return borrowRates;
  }

  for (let waveStart = 0; waveStart < marketContracts.length; waveStart += BORROW_RATE_BATCH_SIZE * BORROW_RATE_PARALLEL_BATCHES) {
    const waveChunks: (typeof marketContracts)[] = [];

    for (let chunkIndex = 0; chunkIndex < BORROW_RATE_PARALLEL_BATCHES; chunkIndex += 1) {
      const chunkStart = waveStart + chunkIndex * BORROW_RATE_BATCH_SIZE;
      if (chunkStart >= marketContracts.length) {
        break;
      }

      waveChunks.push(marketContracts.slice(chunkStart, chunkStart + BORROW_RATE_BATCH_SIZE));
    }

    const waveResults = await Promise.all(
      waveChunks.map((marketChunk) =>
        client.multicall({
          contracts: marketChunk.map((entry) => entry.contract),
          allowFailure: true,
          blockNumber: BigInt(blockNumber),
        }),
      ),
    );

    waveResults.forEach((results, waveIndex) => {
      const marketChunk = waveChunks[waveIndex] ?? [];

      results.forEach((result, resultIndex) => {
        if (result.status !== 'success' || result.result == null) {
          return;
        }

        const marketKey = marketChunk[resultIndex]?.marketKey;
        if (!marketKey) {
          return;
        }

        borrowRates.set(marketKey, result.result);
      });
    });
  }

  return borrowRates;
};

const fetchBoundaryStatesAtBlock = async (
  markets: RateEnrichmentMarketInput[],
  chainId: SupportedNetworks,
  client: ReturnType<typeof getClient>,
  blockNumber: number,
  blockTimestamp: number,
): Promise<Map<string, BoundaryState>> => {
  const snapshots = await fetchMarketsSnapshots(
    markets.map((market) => market.uniqueKey),
    chainId,
    client,
    blockNumber,
  );
  const borrowRates = await fetchBoundaryBorrowRates(markets, snapshots, client, blockNumber);
  const boundaryStates = new Map<string, BoundaryState>();

  markets.forEach((market) => {
    const marketKey = market.uniqueKey.toLowerCase();
    const snapshot = snapshots.get(marketKey);
    const borrowRate = borrowRates.get(marketKey);

    if (!snapshot || borrowRate == null || isUninitializedSnapshot(snapshot)) {
      return;
    }

    const accruedState = accrueSnapshotToTimestamp(snapshot, borrowRate, blockTimestamp);
    if (!accruedState) {
      return;
    }

    boundaryStates.set(marketKey, accruedState);
  });

  return boundaryStates;
};

export const getMarketRateEnrichmentKey = (marketId: string, chainId: number): string => `${chainId}-${marketId.toLowerCase()}`;

export async function fetchRealizedMarketWindowRates(
  markets: RateEnrichmentMarketInput[],
  requestedWindows: number[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<MarketWindowRatesMap> {
  const marketWindowRates = new Map<string, MarketWindowRates>();

  if (markets.length === 0 || requestedWindows.length === 0) {
    return marketWindowRates;
  }

  const uniqueWindows = Array.from(new Set(requestedWindows.filter((window) => window > 0))).sort((left, right) => left - right);
  if (uniqueWindows.length === 0) {
    return marketWindowRates;
  }

  const marketsByChain = markets.reduce(
    (acc, market) => {
      const chainId = market.morphoBlue.chain.id as SupportedNetworks;
      const chainMarkets = acc[chainId] ?? [];
      chainMarkets.push(market);
      acc[chainId] = chainMarkets;
      return acc;
    },
    {} as Record<SupportedNetworks, RateEnrichmentMarketInput[]>,
  );

  await Promise.all(
    Object.entries(marketsByChain).map(async ([chainIdValue, chainMarkets]) => {
      const chainId = Number(chainIdValue) as SupportedNetworks;
      const client = getClient(chainId, customRpcUrls[chainId]);

      chainMarkets.forEach((market) => {
        marketWindowRates.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), buildEmptyWindowRates(uniqueWindows));
      });

      try {
        const latestBlockNumber = Number(await client.getBlockNumber());
        const latestBlock = await client.getBlock({ blockNumber: BigInt(latestBlockNumber) });
        const latestTimestamp = Number(latestBlock.timestamp);
        const boundaryBlocks = await fetchBlocksWithTimestamps(
          client,
          chainId,
          uniqueWindows.map((window) => latestTimestamp - window),
          latestBlockNumber,
          latestTimestamp,
        );

        const boundaryStatesByWindow = new Map<number, Map<string, BoundaryState>>();
        const latestBoundaryStates = await fetchBoundaryStatesAtBlock(chainMarkets, chainId, client, latestBlockNumber, latestTimestamp);

        await Promise.all(
          boundaryBlocks.map(async (boundary) => {
            const windowSeconds = latestTimestamp - boundary.targetTimestamp;
            const boundaryStates = await fetchBoundaryStatesAtBlock(
              chainMarkets,
              chainId,
              client,
              boundary.blockNumber,
              boundary.timestamp,
            );
            boundaryStatesByWindow.set(windowSeconds, boundaryStates);
          }),
        );

        chainMarkets.forEach((market) => {
          const marketKey = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
          const marketRates = marketWindowRates.get(marketKey);
          const latestState = latestBoundaryStates.get(market.uniqueKey.toLowerCase());

          if (!marketRates || !latestState) {
            return;
          }

          uniqueWindows.forEach((windowSeconds) => {
            const startState = boundaryStatesByWindow.get(windowSeconds)?.get(market.uniqueKey.toLowerCase());
            if (!startState) {
              return;
            }

            marketRates.set(windowSeconds, computeWindowRates(startState, latestState));
          });
        });
      } catch (error) {
        console.warn(`[market-rate-enrichment] Failed to calculate realized rates for chain ${chainId}:`, error);
      }
    }),
  );

  return marketWindowRates;
}

export async function fetchMarketRateEnrichment(
  markets: RateEnrichmentMarketInput[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<MarketRateEnrichmentMap> {
  const enrichments = new Map<string, MarketRateEnrichment>();

  if (markets.length === 0) {
    return enrichments;
  }

  const marketsByChain = markets.reduce((acc, market) => {
    const chainId = market.morphoBlue.chain.id as SupportedNetworks;
    const chainMarkets = acc.get(chainId) ?? [];
    chainMarkets.push(market);
    acc.set(chainId, chainMarkets);
    return acc;
  }, new Map<SupportedNetworks, RateEnrichmentMarketInput[]>());

  for (const [chainId, chainMarkets] of marketsByChain.entries()) {
    const morphoEnrichmentsByKey = await fetchMorphoRateMarketsByKey(chainMarkets, chainId);
    const fallbackMarkets: RateEnrichmentMarketInput[] = [];

    chainMarkets.forEach((market) => {
      const key = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
      const morphoEnrichment = morphoEnrichmentsByKey.get(key) ?? buildEmptyEnrichment();
      enrichments.set(key, morphoEnrichment);

      if (hasMissingRateFields(morphoEnrichment)) {
        fallbackMarkets.push(market);
      }
    });

    if (fallbackMarkets.length === 0) {
      continue;
    }

    const windowRates = await fetchRealizedMarketWindowRates(
      fallbackMarkets,
      LOOKBACK_WINDOWS.map((window) => window.seconds),
      customRpcUrls,
    );

    fallbackMarkets.forEach((market) => {
      const key = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
      const ratesByWindow = windowRates.get(key);

      if (!ratesByWindow) {
        return;
      }

      const fallbackEnrichment = LOOKBACK_WINDOWS.reduce<MarketRateEnrichment>((acc, window: LookbackWindow) => {
        const windowRatesEntry = ratesByWindow.get(window.seconds);
        acc[window.supplyField] = windowRatesEntry?.supplyApy ?? null;
        acc[window.borrowField] = windowRatesEntry?.borrowApy ?? null;
        return acc;
      }, buildEmptyEnrichment());

      enrichments.set(key, mergeMarketRateEnrichment(enrichments.get(key) ?? buildEmptyEnrichment(), fallbackEnrichment));
    });
  }

  return enrichments;
}
